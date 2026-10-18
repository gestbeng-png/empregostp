import type { Firestore } from 'firebase-admin/firestore';

import type { TransitionPolicy } from '@/application/marketplace/ports';
import { success } from '@/domain/shared/Result';
import { FirestoreLifecycleStore } from '@/infrastructure/firebase/marketplace/FirestoreLifecycleStore';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
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
      writes.push(...pending);
      return result;
    },
  } as unknown as Firestore;
  return { db, writes };
}

const owner = 'u-owner';
const org = 'org-a';
const publishedJob = {
  v2Status: 'PUBLISHED',
  status: 'active',
  version: 4,
  organizationId: org,
};
const users = {
  [`users/${owner}`]: { userType: 'empresa' },
  [`organizationMemberships/${membershipId(owner, org)}`]: {
    userId: owner,
    organizationId: org,
    role: 'OWNER',
    status: 'ACTIVE',
  },
};
const expiredPolicy: TransitionPolicy = async () =>
  success({ guards: { hasExpired: true } });
const base = {
  kind: 'Job' as const,
  entityId: 'job-1',
  to: 'EXPIRED',
  expectedVersion: 4,
  idempotencyKey: 'expire-job-1-2026-10-08',
};

describe('LIF-01 — transições do sistema', () => {
  it('o cron expira uma vaga: estado legado, histórico e auditoria em nome do sistema', async () => {
    const { db, writes } = fakeFirestore({
      ...users,
      'jobs/job-1': publishedJob,
    });
    const result = await new FirestoreLifecycleStore(
      db,
      () => 5_000,
    ).transitionAsSystem({ ...base, systemJob: 'expireJobs' }, expiredPolicy);

    expect(result).toMatchObject({
      ok: true,
      value: { status: 'EXPIRED', version: 5 },
    });
    const byPath = (prefix: string) =>
      writes.find((write) => write.path.startsWith(prefix));
    expect(byPath('jobs/job-1')?.data).toMatchObject({
      v2Status: 'EXPIRED',
      status: 'closed',
      updatedBy: 'system:expireJobs',
    });
    expect(byPath('jobsStatusHistory/')?.data).toMatchObject({
      from: 'PUBLISHED',
      to: 'EXPIRED',
      actorId: 'system:expireJobs',
      actorType: 'SYSTEM',
    });
    expect(byPath('auditLogs/')?.data).toMatchObject({ actorType: 'SYSTEM' });
    expect(byPath('outboxEvents/')?.data).toMatchObject({
      type: 'entity_status_changed',
    });
  });

  it('a empresa dona não pode expirar a vaga (só o sistema)', async () => {
    const { db, writes } = fakeFirestore({
      ...users,
      'jobs/job-1': publishedJob,
    });
    const result = await new FirestoreLifecycleStore(db).transition(
      { ...base, actorUserId: owner },
      expiredPolicy,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_FORBIDDEN' },
    });
    expect(writes).toEqual([]);
  });

  it('ninguém se faz passar pelo sistema usando o id «system:…»', async () => {
    const { db, writes } = fakeFirestore({
      ...users,
      'users/system:expireJobs': { userType: 'empresa' },
      'jobs/job-1': publishedJob,
    });
    const result = await new FirestoreLifecycleStore(db).transition(
      { ...base, actorUserId: 'system:expireJobs' },
      expiredPolicy,
    );

    expect(result.ok).toBe(false);
    expect(writes).toEqual([]);
  });

  test.each(['', 'Expire', 'expire jobs', 'x/y', 'a'.repeat(60)])(
    'nome de job inválido %p é recusado',
    async (systemJob) => {
      const { db, writes } = fakeFirestore({ 'jobs/job-1': publishedJob });
      const result = await new FirestoreLifecycleStore(db).transitionAsSystem(
        { ...base, systemJob },
        expiredPolicy,
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
      expect(writes).toEqual([]);
    },
  );

  it('sem a condição de expiração, o sistema também não avança', async () => {
    const { db, writes } = fakeFirestore({ 'jobs/job-1': publishedJob });
    const result = await new FirestoreLifecycleStore(db).transitionAsSystem(
      { ...base, systemJob: 'expireJobs' },
      async () => success({}),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    expect(writes).toEqual([]);
  });

  it('subscrição expirada continua bloqueada até migrar os planos (MIG-01)', async () => {
    const { db, writes } = fakeFirestore({
      'subscriptions/sub-1': {
        v2Status: 'PAST_DUE',
        status: 'active',
        version: 2,
      },
    });
    const result = await new FirestoreLifecycleStore(db).transitionAsSystem(
      {
        kind: 'Subscription',
        entityId: 'sub-1',
        to: 'EXPIRED',
        expectedVersion: 2,
        idempotencyKey: 'expire-sub-1-2026-10-08',
        systemJob: 'subscriptionLifecycle',
      },
      async () => success({ guards: { graceExpired: true } }),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'LEGACY_STATUS_UNMAPPED' },
    });
    expect(writes).toEqual([]);
  });

  it('primeira visualização: o sistema passa a candidatura para «Em análise»', async () => {
    const { db, writes } = fakeFirestore({
      'applications/app-1': {
        v2Status: 'SUBMITTED',
        status: 'pending',
        version: 0,
        organizationId: org,
      },
    });
    const result = await new FirestoreLifecycleStore(db).transitionAsSystem(
      {
        kind: 'Application',
        entityId: 'app-1',
        to: 'UNDER_REVIEW',
        expectedVersion: 0,
        idempotencyKey: 'first-view-app-1-0001',
        systemJob: 'firstView',
      },
      async () => success({}),
    );

    expect(result.ok).toBe(true);
    expect(
      writes.find((write) => write.path === 'applications/app-1')?.data,
    ).toMatchObject({
      v2Status: 'UNDER_REVIEW',
      status: 'analysis',
    });
  });
});
