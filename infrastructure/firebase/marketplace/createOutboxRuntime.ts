import { randomUUID } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import { ProcessOutbox } from '@/application/outbox/ProcessOutbox';
import type { OutboxCronRuntime } from '@/presentation/outbox/createOutboxCronHandler';

import { EmailNotificationDispatcher } from './EmailNotificationDispatcher';
import { FirestoreEventProjection } from './FirestoreEventProjection';
import { FirestoreFeatureFlags } from './FirestoreFeatureFlags';
import { FirestoreNotificationDispatcher } from './FirestoreNotificationDispatcher';
import { FirestoreOutboxStore } from './FirestoreOutboxStore';

export function createOutboxRuntime(
  db: Firestore,
  now: () => number = Date.now,
): OutboxCronRuntime {
  const flags = new FirestoreFeatureFlags(db, now);
  const processor = new ProcessOutbox(
    new FirestoreOutboxStore(db),
    [
      new FirestoreEventProjection(db, now),
      new FirestoreNotificationDispatcher(db, now),
      new EmailNotificationDispatcher(db),
    ],
    flags,
    randomUUID,
    now,
  );
  return {
    process: () => processor.execute(20),
    heartbeat: async (atMs, durationMs, result) => {
      await db
        .collection('operationalHeartbeats')
        .doc('processOutbox')
        .set({ lastSucceededAtMs: atMs, durationMs, result });
    },
  };
}
