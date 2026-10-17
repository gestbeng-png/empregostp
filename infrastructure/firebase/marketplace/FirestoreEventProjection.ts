import type { Firestore } from 'firebase-admin/firestore';

import type { EventHandler } from '@/application/outbox/ProcessOutbox';
import { EVENT_FIELDS, validEventPayload } from '@/domain/outbox/events';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';

import { digest } from './identifiers';

/** Phase-1 handler: a durable internal receipt/projection, not an email,
 * notification or analytics conversion. No external service is called. */
export class FirestoreEventProjection implements EventHandler {
  readonly name = 'record_event_projection';
  readonly eventTypes: readonly string[] = Object.keys(EVENT_FIELDS);
  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  async deliver(event: OutboxEvent, idempotencyKey: string): Promise<void> {
    if (
      event.schemaVersion !== 1 ||
      !validEventPayload(event.type, event.payload) ||
      idempotencyKey !== `${event.id}:${this.name}`
    )
      throw new Error('INVALID_EVENT');
    const ref = this.db
      .collection('eventProjections')
      .doc(digest([event.id, this.name]));
    const payload = Object.fromEntries(
      Object.entries(event.payload).sort(([a], [b]) => a.localeCompare(b)),
    );
    const hash = digest([event.type, event.schemaVersion, payload]);
    await this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists) {
        if (snapshot.data()?.requestHash !== hash)
          throw new Error('PROJECTION_CONFLICT');
        return;
      }
      tx.create(ref, {
        eventId: event.id,
        type: event.type,
        schemaVersion: 1,
        payload,
        requestHash: hash,
        recordedAtMs: this.now(),
      });
    });
  }
}
