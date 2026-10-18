import type { Firestore } from 'firebase-admin/firestore';

import type { TransitionCommand } from '@/application/marketplace/ports';
import {
  LEGACY_STATUS_MAPS,
  legacyStatusUpdate,
} from '@/domain/lifecycle/legacyStatus';
import { LIFECYCLES } from '@/domain/lifecycle/states';
import type { EntityKind } from '@/domain/lifecycle/states';
import { success } from '@/domain/shared/Result';
import { FirestoreLifecycleStore } from '@/infrastructure/firebase/marketplace/FirestoreLifecycleStore';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));

const LEGACY_VALUES = {
  Job: ['draft', 'pending_review', 'active', 'inactive', 'closed', 'rejected'],
  Application: [
    'pending',
    'analysis',
    'interview',
    'approved',
    'rejected',
    'withdrawn',
  ],
  Subscription: ['active'],
} as const;

describe('MIG-01 — mapeamento v2 → estado legado', () => {
  test.each(Object.keys(LEGACY_STATUS_MAPS) as EntityKind[])(
    '%s: cada estado da máquina tem entrada e só usa valores legados conhecidos',
    (kind) => {
      const map = LEGACY_STATUS_MAPS[kind] ?? {};
      const known = LEGACY_VALUES[
        kind as keyof typeof LEGACY_VALUES
      ] as readonly string[];
      expect(Object.keys(map).sort()).toEqual(
        Object.keys(LIFECYCLES[kind]).sort(),
      );
      for (const value of Object.values(map)) {
        if (value !== null) expect(known).toContain(value);
      }
    },
  );

  it('só PUBLISHED torna uma vaga pública (`active`)', () => {
    const publicStates = Object.entries(LEGACY_STATUS_MAPS.Job ?? {})
      .filter(([, legacy]) => legacy === 'active')
      .map(([state]) => state);
    expect(publicStates).toEqual(['PUBLISHED']);
  });

  it('pausar, fechar, expirar e preencher tiram a vaga da listagem', () => {
    for (const state of [
      'PAUSED',
      'CLOSED',
      'EXPIRED',
      'FILLED',
      'ARCHIVED',
      'REJECTED',
    ]) {
      const result = legacyStatusUpdate('Job', state);
      expect(result.ok && result.value.status).not.toBe('active');
    }
  });

  it('rascunhos de candidatura e subscrições expiradas ficam bloqueados', () => {
    expect(legacyStatusUpdate('Application', 'DRAFT')).toMatchObject({
      ok: false,
      error: { code: 'LEGACY_STATUS_UNMAPPED' },
    });
    expect(legacyStatusUpdate('Subscription', 'EXPIRED')).toMatchObject({
      ok: false,
      error: { code: 'LEGACY_STATUS_UNMAPPED' },
    });
  });

  it('entidades sem documentos legados não escrevem nada extra', () => {
    expect(legacyStatusUpdate('Interview', 'CONFIRMED')).toEqual(success({}));
    expect(legacyStatusUpdate('Hire', 'ANNULLED')).toEqual(success({}));
  });

  it('estados desconhecidos e nomes do protótipo são recusados', () => {
    expect(legacyStatusUpdate('Job', 'LIVE').ok).toBe(false);
    expect(legacyStatusUpdate('Job', 'constructor').ok).toBe(false);
  });
});

/** Firestore em memória, só com o que o store usa. */
function fakeFirestore(seed: Record<string, Record<string, unknown>>) {
  const docs = new Map(Object.entries(seed));
  const writes: { op: string; path: string; data: Record<string, unknown> }[] =
    [];
  let auto = 0;
  const ref = (path: string) => ({ id: path.split('/').pop() ?? '', path });
  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => ref(`${name}/${id ?? `auto-${auto++}`}`),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const pending: typeof writes = [];
      const tx = {
        get: async (target: { id: string; path: string }) => ({
          id: target.id,
          exists: docs.has(target.path),
          data: () => docs.get(target.path),
        }),
        update: (target: { path: string }, data: Record<string, unknown>) =>
          pending.push({ op: 'update', path: target.path, data }),
        create: (target: { path: string }, data: Record<string, unknown>) =>
          pending.push({ op: 'create', path: target.path, data }),
        set: (target: { path: string }, data: Record<string, unknown>) =>
          pending.push({ op: 'set', path: target.path, data }),
      };
      const result = await fn(tx);
      writes.push(...pending);
      return result;
    },
  } as unknown as Firestore;
  return { db, writes };
}

describe('MIG-01 — FirestoreLifecycleStore escreve os dois estados', () => {
  const owner = 'u-owner';
  const org = 'org-a';
  const seed = (
    entity: Record<string, unknown>,
    collection: string,
    id: string,
  ) => ({
    [`users/${owner}`]: { userType: 'empresa' },
    [`organizationMemberships/${membershipId(owner, org)}`]: {
      userId: owner,
      organizationId: org,
      role: 'OWNER',
      status: 'ACTIVE',
    },
    [`${collection}/${id}`]: entity,
  });
  const command = (changes: Partial<TransitionCommand>): TransitionCommand => ({
    kind: 'Job',
    entityId: 'job-1',
    actorUserId: owner,
    to: 'PAUSED',
    expectedVersion: 0,
    idempotencyKey: 'chave-idempotente-0001',
    ...changes,
  });
  const allow = async () => success({ guards: { hasCloseOutcome: true } });

  it('pausar uma vaga grava v2Status e status legado na mesma escrita', async () => {
    const { db, writes } = fakeFirestore(
      seed(
        {
          v2Status: 'PUBLISHED',
          status: 'active',
          version: 0,
          organizationId: org,
        },
        'jobs',
        'job-1',
      ),
    );
    const result = await new FirestoreLifecycleStore(
      db,
      () => 1_000,
    ).transition(command({}), allow);

    expect(result.ok).toBe(true);
    const update = writes.find(
      (write) => write.op === 'update' && write.path === 'jobs/job-1',
    );
    expect(update?.data).toMatchObject({
      v2Status: 'PAUSED',
      status: 'inactive',
      version: 1,
    });
  });
});
