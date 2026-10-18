import type { Firestore } from 'firebase-admin/firestore';

import { createApplicationTransitionPolicy } from '@/application/applications/applicationTransitionPolicy';
import { FirestoreLifecycleStore } from '@/infrastructure/firebase/marketplace/FirestoreLifecycleStore';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms, toMillis: () => ms }) },
}));

interface Write {
  op: string;
  path: string;
  data: Record<string, unknown>;
}
function fakeFirestore(seed: Record<string, Record<string, unknown>>) {
  const docs = new Map(Object.entries(seed));
  const writes: Write[] = [];
  let auto = 0;
  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const path = `${name}/${id ?? `auto-${auto++}`}`;
        return { id: path.split('/').pop() ?? '', path };
      },
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const pending: Write[] = [];
      const record =
        (op: string) =>
        (target: { path: string }, data: Record<string, unknown>) =>
          pending.push({ op, path: target.path, data });
      const result = await fn({
        get: async (target: { id: string; path: string }) => ({
          id: target.id,
          exists: docs.has(target.path),
          data: () => docs.get(target.path),
        }),
        update: record('update'),
        create: record('create'),
        set: record('set'),
      });
      for (const write of pending)
        if (write.op === 'update')
          docs.set(write.path, { ...docs.get(write.path), ...write.data });
      writes.push(...pending);
      return result;
    },
  } as unknown as Firestore;
  return { db, writes, docs };
}

const NOW = 1_960_000_000_000;
const company = 'company-1';
const application = (extra: Record<string, unknown> = {}) => ({
  v2Status: 'SUBMITTED',
  status: 'pending',
  version: 1,
  organizationId: company,
  candidateUserId: 'cand-1',
  jobId: 'job-1',
  timeline: [{ title: 'Candidatura enviada' }],
  ...extra,
});
const seed = (
  app: Record<string, unknown>,
  more: Record<string, Record<string, unknown>> = {},
) =>
  fakeFirestore({
    [`users/${company}`]: { userType: 'empresa' },
    'users/other-company': { userType: 'empresa' },
    'users/cand-1': { userType: 'candidato' },
    'applications/app-1': app,
    ...more,
  });
const command = (to: string, extra: Record<string, unknown> = {}) => ({
  kind: 'Application' as const,
  entityId: 'app-1',
  to,
  expectedVersion: 1,
  actorUserId: company,
  idempotencyKey: `key-${to}-0000000000000`,
  ...extra,
});
const transition = (
  db: Firestore,
  to: string,
  extra: Record<string, unknown> = {},
) =>
  new FirestoreLifecycleStore(db, () => NOW).transition(
    command(to, extra),
    createApplicationTransitionPolicy(to, () => NOW),
  );

describe('Fase 3 — ATS v2: transições de candidatura pela organização', () => {
  test('empresa legada (sem membership) é OWNER da sua organização: SUBMITTED → UNDER_REVIEW', async () => {
    const { db, writes } = seed(application());
    const result = await transition(db, 'UNDER_REVIEW');
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'UNDER_REVIEW', version: 2 },
    });
    const update = writes.find((w) => w.op === 'update')?.data;
    expect(update).toMatchObject({
      v2Status: 'UNDER_REVIEW',
      status: 'analysis',
      version: 2,
      firstViewedAt: { ms: NOW },
      lastStatusChangeAt: { ms: NOW },
    });
    expect((update?.timeline as unknown[]).at(-1)).toMatchObject({
      title: 'Em análise',
      byType: 'empresa',
    });
    expect(
      writes.find((w) => w.path.startsWith('applicationsStatusHistory/'))?.data,
    ).toMatchObject({
      from: 'SUBMITTED',
      to: 'UNDER_REVIEW',
      actorType: 'OWNER',
    });
  });

  test('outra empresa não muda a candidatura (IDOR)', async () => {
    const { db, writes } = seed(application());
    const result = await new FirestoreLifecycleStore(db, () => NOW).transition(
      { ...command('UNDER_REVIEW'), actorUserId: 'other-company' },
      createApplicationTransitionPolicy('UNDER_REVIEW', () => NOW),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(writes).toHaveLength(0);
  });

  test('o candidato não pode mudar o estado (só retirar, noutra rota)', async () => {
    const { db } = seed(application());
    const result = await new FirestoreLifecycleStore(db, () => NOW).transition(
      { ...command('SHORTLISTED'), actorUserId: 'cand-1' },
      createApplicationTransitionPolicy('SHORTLISTED', () => NOW),
    );
    expect(result.ok).toBe(false);
  });

  test('rejeitar exige motivo da lista; a nota visível vai para o histórico e para a linha temporal', async () => {
    const { db } = seed(
      application({ v2Status: 'UNDER_REVIEW', status: 'analysis' }),
    );
    expect(await transition(db, 'REJECTED')).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    expect(
      await transition(db, 'REJECTED', { closedReason: 'INVENTADO' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    const { db: db2, writes } = seed(
      application({ v2Status: 'UNDER_REVIEW', status: 'analysis' }),
    );
    const ok = await transition(db2, 'REJECTED', {
      closedReason: 'NOT_SELECTED',
      candidateVisibleNote: 'Obrigado pelo interesse.',
      idempotencyKey: 'key-reject-ok-000000',
    });
    expect(ok).toMatchObject({ ok: true });
    expect(writes.find((w) => w.op === 'update')?.data).toMatchObject({
      v2Status: 'REJECTED',
      status: 'rejected',
      closedReason: 'NOT_SELECTED',
    });
    expect(
      writes.find((w) => w.path.startsWith('applicationsStatusHistory/'))?.data,
    ).toMatchObject({
      closedReason: 'NOT_SELECTED',
      candidateVisibleNote: 'Obrigado pelo interesse.',
    });
  });

  test('contratação e proposta não passam por esta rota (fluxos E5/E7)', async () => {
    const { db } = seed(
      application({ v2Status: 'SHORTLISTED', status: 'analysis' }),
    );
    expect(await transition(db, 'HIRED')).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    expect(await transition(db, 'OFFER')).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
  });

  test('reverter rejeição: só OWNER/ADMIN, dentro de 14 dias e com motivo', async () => {
    const recent = application({
      v2Status: 'REJECTED',
      status: 'rejected',
      lastStatusChangeAt: NOW - 3 * 86_400_000,
    });
    const { db } = seed(recent);
    expect(await transition(db, 'UNDER_REVIEW')).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    const { db: db2 } = seed(recent);
    expect(
      await transition(db2, 'UNDER_REVIEW', {
        reason: 'Rejeitada por engano no lote',
      }),
    ).toMatchObject({ ok: true });
    const old = application({
      v2Status: 'REJECTED',
      status: 'rejected',
      lastStatusChangeAt: NOW - 15 * 86_400_000,
    });
    const { db: db3 } = seed(old);
    expect(
      await transition(db3, 'UNDER_REVIEW', { reason: 'tarde demais' }),
    ).toMatchObject({ ok: false });
  });

  test('recrutador com membership de outra organização não vê candidaturas desta', async () => {
    const { db } = seed(application(), {
      'users/recruiter-x': { userType: 'empresa' },
      [`organizationMemberships/${membershipId('recruiter-x', 'org-x')}`]: {
        userId: 'recruiter-x',
        organizationId: 'org-x',
        role: 'RECRUITER',
        status: 'ACTIVE',
      },
    });
    const result = await new FirestoreLifecycleStore(db, () => NOW).transition(
      { ...command('UNDER_REVIEW'), actorUserId: 'recruiter-x' },
      createApplicationTransitionPolicy('UNDER_REVIEW', () => NOW),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  test('candidato com membership de recrutador na organização certa pode avançar (RECRUITER)', async () => {
    const { db } = seed(application(), {
      'users/rec-1': { userType: 'empresa' },
      [`organizationMemberships/${membershipId('rec-1', company)}`]: {
        userId: 'rec-1',
        organizationId: company,
        role: 'RECRUITER',
        status: 'ACTIVE',
        canViewAllJobs: true,
      },
    });
    const result = await new FirestoreLifecycleStore(db, () => NOW).transition(
      { ...command('SHORTLISTED'), actorUserId: 'rec-1' },
      createApplicationTransitionPolicy('SHORTLISTED', () => NOW),
    );
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'SHORTLISTED' },
    });
  });
});
