import {
  SubmitApplication,
  applicationIdFor,
} from '@/application/applications/SubmitApplication';
import type {
  ApplicationSubmissionStore,
  PersistApplicationInput,
  PersistOutcome,
  SubmitApplicationCommand,
} from '@/application/applications/SubmitApplication';
import { isAcceptingApplications } from '@/domain/jobs/deadlines';
import { readJobLifecycle } from '@/domain/jobs/legacyView';

const NOW = new Date('2026-10-10T10:00:00Z');
const KEY = 'f1b2c3d4-0000-4000-8000-000000000001';

/** Reproduz as garantias da transação Firestore: chave → resposta gravada,
 * documento determinístico → unicidade, vaga relida → prazo no servidor. */
class MemoryStore implements ApplicationSubmissionStore {
  jobs = new Map<string, Record<string, unknown>>();
  applications = new Map<string, Record<string, unknown>>();
  keys = new Map<string, { jobId: string; applicationId: string }>();
  users = new Map<
    string,
    { user: Record<string, unknown>; profile: Record<string, unknown> }
  >();
  persisted: PersistApplicationInput[] = [];

  async loadCandidate(id: string) {
    return this.users.get(id) ?? null;
  }
  async loadJob(id: string) {
    const data = this.jobs.get(id);
    return data ? { id, data } : null;
  }
  async findExisting(id: string) {
    const app = this.applications.get(id);
    return app ? { submittedAt: app.submittedAt as Date } : null;
  }
  async persist(
    input: PersistApplicationInput,
    now: Date,
  ): Promise<PersistOutcome> {
    const keyId = `${input.candidateUserId}:${input.idempotencyKey}`;
    const saved = this.keys.get(keyId);
    if (saved)
      return saved.jobId === input.jobId
        ? { kind: 'REPLAYED', applicationId: saved.applicationId }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
    const existing = this.applications.get(input.applicationId);
    if (existing)
      return {
        kind: 'ALREADY_APPLIED',
        submittedAt: existing.submittedAt as Date,
      };
    const job = this.jobs.get(input.jobId);
    if (!job || !isAcceptingApplications(readJobLifecycle(job), now))
      return { kind: 'JOB_NOT_ACCEPTING' };
    this.applications.set(input.applicationId, {
      ...input.document,
      submittedAt: now,
    });
    this.keys.set(keyId, {
      jobId: input.jobId,
      applicationId: input.applicationId,
    });
    this.persisted.push(input);
    return { kind: 'CREATED', applicationId: input.applicationId };
  }
}

function setup(
  options: { flag?: boolean; rateLimit?: boolean; cvCopy?: string | null } = {},
) {
  const store = new MemoryStore();
  store.jobs.set('job1', {
    status: 'active',
    titulo: 'Contabilista',
    dataFecho: '2026-11-15',
    companyId: 'org-owner',
    riskScore: 99,
    screeningQuestions: [{ id: 'q1', required: true }, { id: 'q2' }],
  });
  store.users.set('cand1', {
    user: {
      userType: 'candidato',
      fullName: 'Maria Costa',
      email: 'maria@x.st',
      // Plano básico expirado: no v2 é irrelevante (F2.1).
      currentPlan: 'basic_candidato',
      dateOfBirth: '1990-01-01',
    },
    profile: { city: 'São Tomé', cvUrl: 'cvUrl/cand1/cv.pdf', gender: 'F' },
  });
  const copies: string[][] = [];
  const rateLimited: string[] = [];
  const useCase = new SubmitApplication(
    {
      enabled: async (key) =>
        key === 'V2_APPLICATION_SNAPSHOT' && options.flag !== false,
    },
    store,
    {
      copy: async (source, applicationId, attempt) => {
        copies.push([source, applicationId, attempt]);
        return options.cvCopy === undefined
          ? `applicationSnapshots/${applicationId}/${attempt}/cv.pdf`
          : options.cvCopy;
      },
    },
    async (userId) => {
      rateLimited.push(userId);
      return options.rateLimit !== false;
    },
    (userId, value) =>
      typeof value === 'string' && value.startsWith(`cvUrl/${userId}/`)
        ? value
        : null,
    () => NOW,
  );
  return { store, useCase, copies, rateLimited };
}

const command = (
  overrides: Partial<SubmitApplicationCommand> = {},
): SubmitApplicationCommand => ({
  candidateUserId: 'cand1',
  jobId: 'job1',
  idempotencyKey: KEY,
  emailVerified: true,
  phoneVerified: false,
  answers: [{ questionId: 'q1', value: true }],
  coverLetter: '',
  sharedContacts: null,
  source: 'whatsapp',
  utm: { utm_source: 'whatsapp', utm_medium: 'share', other: 'x' },
  legacyFields: { candidateName: 'Maria Costa', jobTitle: 'Contabilista' },
  ...overrides,
});
const ctx = { environment: 'production' as const };
function only<T>(items: readonly T[]): T {
  if (items.length !== 1) throw new Error(`esperava 1, recebi ${items.length}`);
  return items[0] as T;
}

describe('F2 — SubmitApplication', () => {
  test('flag desligada: nada é lido nem gravado (comportamento atual)', async () => {
    const { store, useCase } = setup({ flag: false });
    const result = await useCase.execute(command(), ctx);
    expect(result).toEqual({
      ok: false,
      code: 'FEATURE_DISABLED',
      failures: [],
    });
    expect(store.persisted).toHaveLength(0);
  });

  test('candidatura gratuita grava snapshot completo, id determinístico e estado SUBMITTED', async () => {
    const { store, useCase, copies } = setup();
    const result = await useCase.execute(command(), ctx);
    expect(result).toEqual({
      ok: true,
      applicationId: 'job1_cand1',
      replayed: false,
    });
    const saved = only(store.persisted);
    expect(saved.applicationId).toBe(applicationIdFor('job1', 'cand1'));
    expect(saved.organizationId).toBe('org-owner');
    expect(saved.document).toMatchObject({
      v2Status: 'SUBMITTED',
      version: 1,
      candidateUserId: 'cand1',
      candidateId: 'cand1',
      source: 'whatsapp',
      utm: { utm_source: 'whatsapp', utm_medium: 'share' },
      cvSnapshotKey: `applicationSnapshots/job1_cand1/${KEY}/cv.pdf`,
      candidateName: 'Maria Costa',
    });
    expect(copies).toEqual([['cvUrl/cand1/cv.pdf', 'job1_cand1', KEY]]);
    const serialized = JSON.stringify(saved.document);
    expect(serialized).not.toContain('1990-01-01');
    expect(serialized).not.toContain('riskScore');
    expect(serialized).not.toContain('currentPlan');
    expect(Object.isFrozen(saved.document)).toBe(true);
  });

  test('duplo clique (mesma chave) devolve a mesma candidatura sem segunda gravação', async () => {
    const { store, useCase, copies, rateLimited } = setup();
    const first = await useCase.execute(command(), ctx);
    const second = await useCase.execute(command(), ctx);
    expect(first).toMatchObject({ ok: true, applicationId: 'job1_cand1' });
    expect(second).toEqual({
      ok: true,
      applicationId: 'job1_cand1',
      replayed: true,
    });
    expect(store.persisted).toHaveLength(1);
    // A retoma não copia o CV de novo nem gasta o limite anti-spam.
    expect(copies).toHaveLength(1);
    expect(rateLimited).toHaveLength(1);
  });

  test('nova chave para a mesma vaga → «Já se candidatou» com data', async () => {
    const { useCase } = setup();
    await useCase.execute(command(), ctx);
    const again = await useCase.execute(
      command({ idempotencyKey: 'f1b2c3d4-0000-4000-8000-000000000002' }),
      ctx,
    );
    expect(again).toMatchObject({
      ok: false,
      code: 'ELIGIBILITY',
      failures: [
        {
          code: 'ALREADY_APPLIED',
          message:
            'Já se candidatou a esta vaga em 10 out. 2026. Acompanhe aqui.',
        },
      ],
    });
  });

  test('prazo passado é recusado no servidor mesmo com o estado legado «active»', async () => {
    const { store, useCase } = setup();
    store.jobs.set('job1', {
      ...store.jobs.get('job1'),
      dataFecho: '2026-10-09',
    });
    const result = await useCase.execute(command(), ctx);
    expect(result).toMatchObject({
      ok: false,
      failures: [{ code: 'JOB_NOT_ACCEPTING' }],
    });
    expect(store.persisted).toHaveLength(0);
  });

  test('vaga que fecha entre a validação e a gravação: a transação recusa', async () => {
    const { store, useCase } = setup();
    const original = store.persist.bind(store);
    store.persist = async (input, now) => {
      store.jobs.set('job1', { ...store.jobs.get('job1'), status: 'closed' });
      return original(input, now);
    };
    expect(await useCase.execute(command(), ctx)).toMatchObject({
      ok: false,
      failures: [{ code: 'JOB_NOT_ACCEPTING' }],
    });
  });

  test('sem chave de idempotência, sem contacto verificado e sem resposta obrigatória', async () => {
    const { useCase } = setup();
    const result = await useCase.execute(
      command({ idempotencyKey: 'curta', emailVerified: false, answers: [] }),
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failures.map((f) => f.code)).toEqual([
      'CONTACT_NOT_VERIFIED',
      'SCREENING_UNANSWERED',
      'IDEMPOTENCY_KEY_MISSING',
    ]);
  });

  test('limite anti-spam (D13) devolve RATE_LIMITED; nunca há opção paga', async () => {
    const { useCase } = setup({ rateLimit: false });
    expect(await useCase.execute(command(), ctx)).toMatchObject({
      ok: false,
      failures: [{ code: 'RATE_LIMITED' }],
    });
  });

  test('perfil sem CV mas com experiência pode candidatar-se (sem cópia de ficheiro)', async () => {
    const { store, useCase, copies } = setup();
    store.users.set('cand1', {
      user: { userType: 'candidato', fullName: 'Rui', email: 'r@x.st' },
      profile: { city: 'Neves', experience: [{ cargo: 'Motorista' }] },
    });
    expect(await useCase.execute(command(), ctx)).toMatchObject({ ok: true });
    expect(copies).toHaveLength(0);
    expect(only(store.persisted).document).toMatchObject({
      cvSnapshotKey: null,
    });
  });

  test('perfil incompleto é recusado com mensagem acionável', async () => {
    const { store, useCase } = setup();
    store.users.set('cand1', {
      user: { userType: 'candidato', fullName: 'Rui', email: 'r@x.st' },
      profile: {},
    });
    expect(await useCase.execute(command(), ctx)).toMatchObject({
      ok: false,
      failures: [{ code: 'PROFILE_INCOMPLETE' }],
    });
  });

  test('falha na cópia do CV não grava uma candidatura sem snapshot íntegro', async () => {
    const { store, useCase } = setup({ cvCopy: null });
    expect(await useCase.execute(command(), ctx)).toEqual({
      ok: false,
      code: 'CV_SNAPSHOT_FAILED',
      failures: [],
    });
    expect(store.persisted).toHaveLength(0);
  });

  test('CV de outra pessoa nunca é copiado', async () => {
    const { store, useCase, copies } = setup();
    store.users.set('cand1', {
      user: { userType: 'candidato', fullName: 'Rui', email: 'r@x.st' },
      profile: {
        city: 'Neves',
        cvUrl: 'cvUrl/outro/cv.pdf',
        education: 'Licenciatura em Gestão',
      },
    });
    expect(await useCase.execute(command(), ctx)).toMatchObject({ ok: true });
    expect(copies).toHaveLength(0);
  });

  test('empresas e vagas inexistentes', async () => {
    const { store, useCase } = setup();
    expect(
      await useCase.execute(command({ jobId: 'nope' }), ctx),
    ).toMatchObject({
      code: 'NOT_FOUND',
    });
    store.users.set('cand1', { user: { userType: 'empresa' }, profile: {} });
    expect(await useCase.execute(command(), ctx)).toMatchObject({
      code: 'NOT_CANDIDATE',
    });
  });

  test('F2.3/F3.4: requisitos em falta são registados, nunca bloqueiam', async () => {
    const { store, useCase } = setup();
    const result = await useCase.execute(
      command({
        hardRequirementsNotMet: [
          'DOCUMENT:certificates',
          'DOCUMENT:certificates',
          'lixo sem formato',
        ],
      }),
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(only(store.persisted).document).toMatchObject({
      hardRequirementsNotMet: ['DOCUMENT:certificates'],
      knockoutFailed: false,
    });
  });

  test('F3.4: resposta contrária a eliminatório marca a candidatura, não a rejeita', async () => {
    const { store, useCase } = setup();
    store.jobs.set('job1', {
      ...store.jobs.get('job1'),
      screeningQuestions: [
        {
          id: 'q1',
          type: 'BOOLEAN',
          label: 'Tem carta de condução B?',
          required: true,
          knockout: { expected: true },
        },
      ],
    });
    const result = await useCase.execute(
      command({ answers: [{ questionId: 'q1', value: false }] }),
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(only(store.persisted).document).toMatchObject({
      knockoutFailed: true,
      hardRequirementsNotMet: ['KNOCKOUT:q1'],
      v2Status: 'SUBMITTED',
    });
  });
});
