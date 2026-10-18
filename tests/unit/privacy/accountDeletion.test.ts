import {
  ACCOUNT_DELETION_GRACE_DAYS,
  REMOVED_CANDIDATE_NAME,
  buildPendingDeletion,
  candidateStoragePrefixes,
  evaluateDeletionRequest,
  isDeletionDue,
  planApplicationAnonymization,
} from '@/lib/accountDeletion';
import { executeDueAccountDeletions } from '@/lib/accountDeletionExecutor';
import { toExportValue } from '@/lib/candidateDataExport';
import { getCandidatePrivacy } from '@/lib/candidatePrivacy';
import { isUserAccountActive } from '@/lib/userStatus';
import { createFakeFirestore } from '@/tests/helpers/fakeFirestore';

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const DAY = 86_400_000;
const candidate = { userType: 'candidato', email: 'ana@exemplo.st' };

describe('evaluateDeletionRequest (H5)', () => {
  const valid = {
    userData: candidate,
    authTimeSeconds: Math.floor(NOW / 1000) - 60,
    confirmation: 'eliminar',
    nowMs: NOW,
  };

  test('aceita um candidato que acabou de iniciar sessão e confirmou', () => {
    expect(evaluateDeletionRequest(valid)).toEqual({ ok: true });
  });

  test.each([
    [
      'conta de empresa',
      { userData: { userType: 'empresa' } },
      'NOT_CANDIDATE',
    ],
    [
      'pedido já pendente',
      { userData: { ...candidate, deletion: buildPendingDeletion(NOW) } },
      'ALREADY_PENDING',
    ],
    [
      'sem a palavra de confirmação',
      { confirmation: 'sim' },
      'CONFIRMATION_REQUIRED',
    ],
    [
      'sessão iniciada há mais de 5 minutos',
      { authTimeSeconds: Math.floor(NOW / 1000) - 301 },
      'REAUTH_REQUIRED',
    ],
    ['sem auth_time', { authTimeSeconds: undefined }, 'REAUTH_REQUIRED'],
  ])('recusa: %s', (_label, override, code) => {
    expect(evaluateDeletionRequest({ ...valid, ...override })).toMatchObject({
      ok: false,
      code,
    });
  });
});

test('o prazo para cancelar é de 7 dias', () => {
  const pending = buildPendingDeletion(NOW);
  expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(7);
  expect(pending.executeAfterMs - NOW).toBe(7 * DAY);
  expect(isDeletionDue({ deletion: pending }, NOW + 7 * DAY - 1)).toBe(false);
  expect(isDeletionDue({ deletion: pending }, NOW + 7 * DAY)).toBe(true);
});

describe('planApplicationAnonymization', () => {
  const personal = {
    candidateName: 'Ana Costa',
    candidateEmail: 'ana@exemplo.st',
    coverLetter: 'Carta',
    applicationForm: { phone: '+239 999' },
    candidateSnapshot: { fullName: 'Ana Costa' },
    answersSnapshot: [{ id: 'q1', value: 'sim' }],
    timeline: [
      {
        title: 'Candidatura enviada',
        description: 'Ana enviou carta',
        date: '2026-10-01',
        by: 'u1',
        byType: 'candidato',
      },
    ],
  };

  test('retira uma candidatura antiga em curso e apaga os dados pessoais', () => {
    const plan = planApplicationAnonymization(
      { ...personal, status: 'analysis' },
      '2026-10-18T00:00:00.000Z',
    );
    expect(plan.withdraw).toBe(true);
    expect(plan.update).toMatchObject({
      status: 'withdrawn',
      withdrawalReason: 'ACCOUNT_DELETED',
      candidateName: REMOVED_CANDIDATE_NAME,
      candidateEmail: null,
      coverLetter: '',
      applicationForm: null,
      candidateSnapshot: null,
      answersSnapshot: null,
      candidateRemoved: true,
    });
    // A linha temporal mantém o percurso mas perde texto e autoria.
    expect(plan.update.timeline[0]).toEqual({
      title: 'Candidatura enviada',
      date: '2026-10-01',
      icon: '',
      byType: 'candidato',
    });
    expect(JSON.stringify(plan.update)).not.toMatch(/Ana|\+239|u1/);
  });

  test('candidatura v2 em entrevista passa a WITHDRAWN com nova versão', () => {
    const plan = planApplicationAnonymization(
      { ...personal, v2Status: 'INTERVIEW', status: 'interview', version: 3 },
      '2026-10-18T00:00:00.000Z',
    );
    expect(plan).toMatchObject({ withdraw: true, from: 'INTERVIEW' });
    expect(plan.update).toMatchObject({
      v2Status: 'WITHDRAWN',
      status: 'withdrawn',
      version: 4,
    });
  });

  test.each([
    [{ status: 'approved' }],
    [{ status: 'rejected' }],
    [{ v2Status: 'HIRED', status: 'approved' }],
    [{ v2Status: 'REJECTED', status: 'rejected' }],
  ])('mantém o estado de uma candidatura já decidida: %j', (state) => {
    const plan = planApplicationAnonymization(
      { ...personal, ...state },
      '2026-10-18T00:00:00.000Z',
    );
    expect(plan.withdraw).toBe(false);
    expect((plan.update as Record<string, unknown>).status).toBeUndefined();
    expect(plan.update.candidateName).toBe(REMOVED_CANDIDATE_NAME);
  });
});

test('as pastas do Storage nunca saem da pasta do próprio utilizador', () => {
  expect(candidateStoragePrefixes('abcDEF123456')).toContain(
    'cvUrl/abcDEF123456/',
  );
  expect(candidateStoragePrefixes('abcDEF123456')).not.toContainEqual(
    expect.stringMatching(/^payment-proofs/),
  );
  for (const bad of ['', '../x', 'a/b', 'abc', '*']) {
    expect(() => candidateStoragePrefixes(bad)).toThrow();
  }
});

test('com eliminação pedida o perfil fica privado sem perder a escolha guardada', () => {
  const profile = { settings: { privacy: { profileVisibility: 'public' } } };
  expect(getCandidatePrivacy(profile).profileVisibility).toBe('public');
  expect(
    getCandidatePrivacy({ ...profile, pendingDeletion: true })
      .profileVisibility,
  ).toBe('private');
});

test('uma conta eliminada não é uma conta ativa', () => {
  expect(isUserAccountActive({ status: 'deleted' })).toBe(false);
});

test('a exportação converte datas e não leva credenciais', () => {
  expect(
    toExportValue({
      createdAt: { toDate: () => new Date('2026-01-02T03:04:05.000Z') },
      nested: { unsubscribeTokenHash: 'x', keep: 1 },
      fcmTokens: ['t'],
      list: [{ _seconds: 0, _nanoseconds: 0 }],
    }),
  ).toEqual({
    createdAt: '2026-01-02T03:04:05.000Z',
    nested: { keep: 1 },
    list: ['1970-01-01T00:00:00.000Z'],
  });
});

describe('executeDueAccountDeletions', () => {
  const uid = 'candidateA01';

  function setup({ due = true, storageFails = false } = {}) {
    const deletion = buildPendingDeletion(due ? NOW - 8 * DAY : NOW - DAY);
    const { db, docs } = createFakeFirestore({
      [`users/${uid}`]: { ...candidate, fullName: 'Ana Costa', deletion },
      'users/candidateB02': { userType: 'candidato', email: 'b@exemplo.st' },
      [`profiles/${uid}`]: { headline: 'Contabilista', pendingDeletion: true },
      'applications/job1_a': {
        candidateId: uid,
        candidateName: 'Ana Costa',
        status: 'pending',
        jobId: 'job1',
      },
      'applications/job2_a': {
        candidateId: uid,
        candidateName: 'Ana Costa',
        v2Status: 'SHORTLISTED',
        status: 'analysis',
        version: 2,
        jobId: 'job2',
      },
      'applications/job3_a': {
        candidateId: uid,
        candidateName: 'Ana Costa',
        status: 'approved',
        jobId: 'job3',
      },
      'applications/job1_b': {
        candidateId: 'candidateB02',
        candidateName: 'Bruno',
        status: 'pending',
      },
      'savedJobs/s1': { candidateId: uid, jobId: 'job9' },
      'notifications/n1': { userId: uid, title: 'x' },
      'notifications/n2': { userId: 'candidateB02', title: 'y' },
      [`users/${uid}/formDrafts/d1`]: { value: 'rascunho' },
      'jobAlerts/a1': { email: 'ana@exemplo.st' },
      'consents/c1': { userId: uid, kind: 'JOB_ALERTS' },
      'hires/h1': { candidateUserId: uid, applicationId: 'job3_a' },
    });

    const deletedFiles: string[] = [];
    const stored = [
      `cvUrl/${uid}/cv.pdf`,
      `photoUrl/${uid}/foto.jpg`,
      `verification/identity/${uid}/bi.pdf`,
      `applicationSnapshots/job1_a/cv.pdf`,
      `payment-proofs/${uid}/recibo.pdf`,
      'cvUrl/candidateB02/cv.pdf',
    ];
    const bucket = {
      getFiles: async ({ prefix }: { prefix: string }) => {
        if (storageFails) throw Object.assign(new Error('x'), { code: 503 });
        return [
          stored
            .filter((name) => name.startsWith(prefix))
            .map((name) => ({
              name,
              delete: async () => {
                deletedFiles.push(name);
              },
            })),
        ];
      },
    };
    const deleteUser = jest.fn(async () => undefined);
    const firestore = Object.assign(() => db, {
      FieldValue: { serverTimestamp: () => 'server-ts' },
      Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    });
    const adminApp = {
      firestore,
      storage: () => ({ bucket: () => bucket }),
      auth: () => ({ deleteUser }),
    };
    return { adminApp, docs, deletedFiles, deleteUser };
  }

  test('executa um pedido vencido de ponta a ponta', async () => {
    const { adminApp, docs, deletedFiles, deleteUser } = setup();

    const result = await executeDueAccountDeletions(adminApp, { nowMs: NOW });

    expect(result).toEqual({ pending: 1, due: 1, executed: 1, failed: 0 });

    // Candidaturas: em curso retiradas, decididas mantidas, todas anonimizadas.
    expect(docs.get('applications/job1_a')).toMatchObject({
      status: 'withdrawn',
      candidateName: REMOVED_CANDIDATE_NAME,
      candidateRemoved: true,
    });
    expect(docs.get('applications/job2_a')).toMatchObject({
      v2Status: 'WITHDRAWN',
      status: 'withdrawn',
      version: 3,
    });
    expect(docs.get('applications/job3_a')).toMatchObject({
      status: 'approved',
      candidateName: REMOVED_CANDIDATE_NAME,
    });
    // A candidatura de outra pessoa não é tocada.
    expect(docs.get('applications/job1_b')).toMatchObject({
      candidateName: 'Bruno',
      status: 'pending',
    });
    // Histórico e evento só para a candidatura v2.
    const history = [...docs.entries()].filter(([p]) =>
      p.startsWith('applicationsStatusHistory/'),
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.[1]).toMatchObject({
      entityId: 'job2_a',
      from: 'SHORTLISTED',
      to: 'WITHDRAWN',
      actorType: 'SYSTEM',
      reason: 'ACCOUNT_DELETED',
    });

    // Dados pessoais apagados; os de outras pessoas ficam.
    for (const path of [
      `profiles/${uid}`,
      'savedJobs/s1',
      'notifications/n1',
      `users/${uid}/formDrafts/d1`,
      'jobAlerts/a1',
      'consents/c1',
    ]) {
      expect(docs.has(path)).toBe(false);
    }
    expect(docs.has('notifications/n2')).toBe(true);
    // A contratação fica (só ids), para as métricas agregadas.
    expect(docs.has('hires/h1')).toBe(true);

    expect(deletedFiles.sort()).toEqual(
      [
        `applicationSnapshots/job1_a/cv.pdf`,
        `cvUrl/${uid}/cv.pdf`,
        `photoUrl/${uid}/foto.jpg`,
        `verification/identity/${uid}/bi.pdf`,
      ].sort(),
    );

    expect(deleteUser).toHaveBeenCalledWith(uid);
    expect(docs.get(`users/${uid}`)).toEqual({
      userType: 'deleted',
      status: 'deleted',
      fullName: REMOVED_CANDIDATE_NAME,
      name: REMOVED_CANDIDATE_NAME,
      displayName: REMOVED_CANDIDATE_NAME,
      deletedAtMs: NOW,
      deletion: {
        status: 'DONE',
        requestedAtMs: NOW - 8 * DAY,
        executedAtMs: NOW,
      },
    });
    const audit = [...docs.entries()].find(([p]) => p.startsWith('auditLogs/'));
    expect(audit?.[1]).toMatchObject({
      action: 'account_deleted',
      resourceId: uid,
      metadata: { applications: 3, applicationsWithdrawn: 2, files: 4 },
    });
    expect(JSON.stringify(audit?.[1])).not.toMatch(/Ana|exemplo/);

    // Repetir não faz nada: o pedido já não está pendente.
    expect(await executeDueAccountDeletions(adminApp, { nowMs: NOW })).toEqual({
      pending: 0,
      due: 0,
      executed: 0,
      failed: 0,
    });
  });

  test('não executa antes do fim dos 7 dias', async () => {
    const { adminApp, docs, deleteUser } = setup({ due: false });
    expect(await executeDueAccountDeletions(adminApp, { nowMs: NOW })).toEqual({
      pending: 1,
      due: 0,
      executed: 0,
      failed: 0,
    });
    expect(docs.has(`profiles/${uid}`)).toBe(true);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test('uma falha a meio deixa o pedido pendente para nova tentativa', async () => {
    const { adminApp, docs, deleteUser } = setup({ storageFails: true });

    const result = await executeDueAccountDeletions(adminApp, { nowMs: NOW });

    expect(result).toMatchObject({ executed: 0, failed: 1 });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(docs.get(`users/${uid}`)).toMatchObject({
      email: 'ana@exemplo.st',
      deletion: { status: 'PENDING', lastError: '503', lastAttemptAtMs: NOW },
    });
  });
});
