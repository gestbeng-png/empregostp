import type { Firestore } from 'firebase-admin/firestore';

import { failure, success } from '@/domain/shared/Result';
import { FirestoreLifecycleStore } from '@/infrastructure/firebase/marketplace/FirestoreLifecycleStore';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));

// Hoje os estados sem equivalente legado só são alcançáveis pelo SYSTEM.
// Forçamos o mapeamento a falhar numa transição de utilizador para provar
// que o store não escreve nada (nem histórico, nem outbox, nem auditoria).
jest.mock('@/domain/lifecycle/legacyStatus', () => ({
  legacyStatusUpdate: () => failure('LEGACY_STATUS_UNMAPPED'),
}));

it('MIG-01: sem estado legado equivalente, a transição falha fechada e não escreve', async () => {
  const owner = 'u-owner';
  const org = 'org-a';
  const docs = new Map<string, Record<string, unknown>>([
    [`users/${owner}`, { userType: 'empresa' }],
    [
      `organizationMemberships/${membershipId(owner, org)}`,
      { userId: owner, organizationId: org, role: 'OWNER', status: 'ACTIVE' },
    ],
    [
      'jobs/job-1',
      {
        v2Status: 'PUBLISHED',
        status: 'active',
        version: 0,
        organizationId: org,
      },
    ],
  ]);
  const writes: string[] = [];
  let auto = 0;
  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const path = `${name}/${id ?? `auto-${auto++}`}`;
        return { id: path.split('/').pop(), path };
      },
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async (target: { id: string; path: string }) => ({
          id: target.id,
          exists: docs.has(target.path),
          data: () => docs.get(target.path),
        }),
        update: (target: { path: string }) =>
          writes.push(`update ${target.path}`),
        create: (target: { path: string }) =>
          writes.push(`create ${target.path}`),
        set: (target: { path: string }) => writes.push(`set ${target.path}`),
      }),
  } as unknown as Firestore;

  const result = await new FirestoreLifecycleStore(db, () => 1_000).transition(
    {
      kind: 'Job',
      entityId: 'job-1',
      actorUserId: owner,
      to: 'PAUSED',
      expectedVersion: 0,
      idempotencyKey: 'chave-idempotente-0002',
    },
    async () => success({}),
  );

  expect(result).toMatchObject({
    ok: false,
    error: { code: 'LEGACY_STATUS_UNMAPPED' },
  });
  expect(writes).toEqual([]);
});
