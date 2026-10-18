import type { Firestore } from 'firebase-admin/firestore';

import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';
import { FirestoreOutboxStore } from '@/infrastructure/firebase/marketplace/FirestoreOutboxStore';

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { delete: () => '__delete__' },
}));

function storeWith(data: Partial<OutboxEvent>) {
  const updates: Record<string, unknown>[] = [];
  const snapshot = { exists: true, data: () => data };
  const tx = {
    get: jest.fn().mockResolvedValue(snapshot),
    update: jest.fn((_ref: unknown, value: Record<string, unknown>) => {
      updates.push(value);
    }),
  };
  const db = {
    collection: () => ({ doc: () => ({}) }),
    runTransaction: (fn: (transaction: typeof tx) => unknown) => fn(tx),
  } as unknown as Firestore;
  return { store: new FirestoreOutboxStore(db), updates };
}

const base: Partial<OutboxEvent> = {
  type: 'entity_status_changed',
  schemaVersion: 1,
  payload: { entityId: 'app-1', entityKind: 'Application', version: 2 },
  createdAtMs: 0,
  nextAttemptAtMs: 0,
};

describe('FirestoreOutboxStore — recuperação (D5)', () => {
  it('uma lease expirada conta como tentativa e não é reclamada de imediato', async () => {
    const { store, updates } = storeWith({
      ...base,
      status: 'PROCESSING',
      attempts: 2,
      leaseId: 'lease-velha',
      leaseUntilMs: 5_000,
    });

    await expect(
      store.claim('evt-1', 10_000, 'lease-nova', 120_000),
    ).resolves.toBeUndefined();
    expect(updates).toEqual([
      {
        status: 'FAILED',
        attempts: 3,
        nextAttemptAtMs: 10_000 + 1_800_000,
        leaseId: '__delete__',
        leaseUntilMs: '__delete__',
        lastErrorCode: 'LEASE_EXPIRED',
      },
    ]);
  });

  it('um evento que mata o worker cinco vezes acaba em DEAD', async () => {
    const { store, updates } = storeWith({
      ...base,
      status: 'PROCESSING',
      attempts: 5,
      leaseId: 'lease-velha',
      leaseUntilMs: 5_000,
    });

    await store.claim('evt-1', 10_000, 'lease-nova', 120_000);
    expect(updates[0]).toMatchObject({ status: 'DEAD', attempts: 5 });
  });

  it('um evento pendente é reclamado normalmente', async () => {
    const { store, updates } = storeWith({
      ...base,
      status: 'PENDING',
      attempts: 0,
    });

    await expect(
      store.claim('evt-1', 10_000, 'lease-nova', 120_000),
    ).resolves.toMatchObject({
      status: 'PROCESSING',
      leaseId: 'lease-nova',
      leaseUntilMs: 130_000,
    });
    expect(updates).toEqual([
      { status: 'PROCESSING', leaseId: 'lease-nova', leaseUntilMs: 130_000 },
    ]);
  });

  it('kill switch adia o evento sem gastar tentativas', async () => {
    const { store, updates } = storeWith({
      ...base,
      status: 'PROCESSING',
      attempts: 4,
      leaseId: 'lease-a',
      leaseUntilMs: 200_000,
    });

    await expect(
      store.fail('evt-1', 'lease-a', 10_000, 'CHANNEL_DISABLED'),
    ).resolves.toBe(true);
    expect(updates[0]).toMatchObject({
      status: 'FAILED',
      attempts: 4,
      nextAttemptAtMs: 70_000,
      lastErrorCode: 'CHANNEL_DISABLED',
    });
  });

  it('uma falha real continua a gastar tentativas', async () => {
    const { store, updates } = storeWith({
      ...base,
      status: 'PROCESSING',
      attempts: 4,
      leaseId: 'lease-a',
      leaseUntilMs: 200_000,
    });

    await store.fail('evt-1', 'lease-a', 10_000, 'HANDLER_FAILED');
    expect(updates[0]).toMatchObject({ status: 'FAILED', attempts: 5 });
  });
});
