import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type { EventHandler } from '@/application/outbox/ProcessOutbox';
import { validEventPayload } from '@/domain/outbox/events';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';

import { digest } from './identifiers';
import {
  RECRUITMENT_NOTIFICATION_EVENTS,
  resolveRecruitmentNotice,
} from './RecruitmentNotificationResolver';

/**
 * Fase 3: entrega a notificação in-app sem depender de email/WhatsApp.
 * A chave do documento é determinística para que o replay do outbox seja
 * seguro e nunca duplique avisos ao candidato.
 */
export class FirestoreNotificationDispatcher implements EventHandler {
  readonly name = 'dispatch_in_app_notification';
  readonly eventTypes = RECRUITMENT_NOTIFICATION_EVENTS;

  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  async deliver(event: OutboxEvent, idempotencyKey: string): Promise<void> {
    if (
      idempotencyKey !== `${event.id}:${this.name}` ||
      !validEventPayload(event.type, event.payload)
    )
      throw new Error('INVALID_EVENT');

    // Invitations have no accepted user yet. Their token belongs only in the email.
    if (event.payload.entityKind === 'TeamInvitation') return;
    const notice = await resolveRecruitmentNotice(this.db, event, this.now());
    if (!notice?.userId) return;
    const id = digest([event.id, this.name, notice.userId]);
    await this.db
      .collection('notifications')
      .doc(id)
      .set(
        {
          id,
          userId: notice.userId,
          type: notice.type,
          entityId: notice.entityId,
          entityKind: notice.entityKind,
          title: notice.title,
          body: notice.body,
          link: notice.path,
          message: notice.body,
          actionUrl: notice.path,
          read: false,
          createdAt: Timestamp.fromMillis(this.now()),
          createdAtMs: this.now(),
          sourceEventId: event.id,
        },
        { merge: false },
      );
  }
}
