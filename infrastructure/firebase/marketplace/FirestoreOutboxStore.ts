import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type { OutboxStore } from '@/application/outbox/ProcessOutbox';
import {
  afterFailure,
  afterLeaseExpired,
  canClaim,
  deferWhileChannelDisabled,
} from '@/domain/outbox/OutboxEvent';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';

import { digest, validDocumentId } from './identifiers';

export class FirestoreOutboxStore implements OutboxStore {
  constructor(private readonly db: Firestore) {}
  async due(now: number, limit: number): Promise<readonly string[]> {
    const queue = this.db.collection('outboxEvents');
    const capped = Math.min(
      100,
      Math.max(1, Number.isSafeInteger(limit) ? limit : 20),
    );
    const [pending, abandoned] = await Promise.all([
      queue
        .where('status', 'in', ['PENDING', 'FAILED'])
        .where('nextAttemptAtMs', '<=', now)
        .orderBy('nextAttemptAtMs')
        .limit(capped)
        .get(),
      queue
        .where('status', '==', 'PROCESSING')
        .where('leaseUntilMs', '<=', now)
        .orderBy('leaseUntilMs')
        .limit(capped)
        .get(),
    ]);
    return [
      ...new Set([...abandoned.docs, ...pending.docs].map((doc) => doc.id)),
    ].slice(0, capped);
  }
  async claim(
    id: string,
    now: number,
    leaseId: string,
    leaseMs: number,
  ): Promise<OutboxEvent | undefined> {
    if (
      !validDocumentId(id) ||
      !validDocumentId(leaseId) ||
      !Number.isFinite(now) ||
      !Number.isSafeInteger(leaseMs) ||
      leaseMs < 1000 ||
      leaseMs > 300_000
    )
      return undefined;
    const ref = this.db.collection('outboxEvents').doc(id);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return undefined;
      const event = { ...snapshot.data(), id } as OutboxEvent;
      if (!canClaim(event, now)) return undefined;
      if (event.status === 'PROCESSING') {
        // Lease expirada: o worker anterior morreu a meio. Conta como
        // tentativa falhada e só volta a ser reclamado depois do backoff.
        tx.update(ref, {
          ...afterLeaseExpired(event, now),
          leaseId: FieldValue.delete(),
          leaseUntilMs: FieldValue.delete(),
          lastErrorCode: 'LEASE_EXPIRED',
        });
        return undefined;
      }
      const claim = {
        status: 'PROCESSING' as const,
        leaseId,
        leaseUntilMs: now + leaseMs,
      };
      tx.update(ref, claim);
      return { ...event, ...claim };
    });
  }
  async delivered(eventId: string, handler: string): Promise<boolean> {
    return (
      await this.db
        .collection('outboxDeliveries')
        .doc(digest([eventId, handler]))
        .get()
    ).exists;
  }
  async markDelivered(
    eventId: string,
    handler: string,
    leaseId: string,
    now: number,
  ): Promise<boolean> {
    const eventRef = this.db.collection('outboxEvents').doc(eventId);
    const receiptRef = this.db
      .collection('outboxDeliveries')
      .doc(digest([eventId, handler]));
    return this.db.runTransaction(async (tx) => {
      const [event, receipt] = await Promise.all([
        tx.get(eventRef),
        tx.get(receiptRef),
      ]);
      const data = event.data();
      if (
        data?.status !== 'PROCESSING' ||
        data.leaseId !== leaseId ||
        data.leaseUntilMs <= now
      )
        return false;
      if (!receipt.exists)
        tx.create(receiptRef, { eventId, handler, deliveredAtMs: now });
      return true;
    });
  }
  async finish(
    eventId: string,
    leaseId: string,
    now: number,
  ): Promise<boolean> {
    return this.settle(eventId, leaseId, now);
  }
  async fail(
    eventId: string,
    leaseId: string,
    now: number,
    errorCode: string,
  ): Promise<boolean> {
    return this.settle(eventId, leaseId, now, errorCode);
  }
  private async settle(
    eventId: string,
    leaseId: string,
    now: number,
    errorCode?: string,
  ): Promise<boolean> {
    const ref = this.db.collection('outboxEvents').doc(eventId);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const event = { ...snapshot.data(), id: eventId } as OutboxEvent;
      if (
        event.status !== 'PROCESSING' ||
        event.leaseId !== leaseId ||
        (event.leaseUntilMs ?? 0) <= now
      )
        return false;
      tx.update(ref, {
        ...(errorCode === 'CHANNEL_DISABLED'
          ? deferWhileChannelDisabled(event, now)
          : errorCode
            ? afterFailure(event, now)
            : { status: 'DONE', completedAtMs: now }),
        leaseId: FieldValue.delete(),
        leaseUntilMs: FieldValue.delete(),
        ...(errorCode
          ? {
              lastErrorCode: /^[A-Z][A-Z0-9_]{1,63}$/.test(errorCode)
                ? errorCode
                : 'HANDLER_FAILED',
            }
          : { lastErrorCode: FieldValue.delete() }),
      });
      return true;
    });
  }
}
