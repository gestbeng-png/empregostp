import type { Firestore } from 'firebase-admin/firestore';

import type { EventHandler } from '@/application/outbox/ProcessOutbox';
import { validEventPayload } from '@/domain/outbox/events';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';
import { sendEmail } from '@/lib/email';

import {
  RECRUITMENT_NOTIFICATION_EVENTS,
  resolveRecruitmentNotice,
} from './RecruitmentNotificationResolver';

/** Entrega notificações transacionais; o outbox controla retry/idempotência. */
export class EmailNotificationDispatcher implements EventHandler {
  readonly name = 'dispatch_transactional_email';
  readonly eventTypes = RECRUITMENT_NOTIFICATION_EVENTS;

  constructor(private readonly db: Firestore) {}

  async deliver(event: OutboxEvent, idempotencyKey: string): Promise<void> {
    if (
      idempotencyKey !== `${event.id}:${this.name}` ||
      !validEventPayload(event.type, event.payload)
    )
      throw new Error('INVALID_EVENT');

    const notice = await resolveRecruitmentNotice(this.db, event);
    if (!notice || typeof notice.email !== 'string' || !notice.email) return;
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (char) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[char] ?? char,
      );
    const url = `https://empregostp.com${notice.path}`;
    await sendEmail({
      to: notice.email,
      subject: notice.title,
      text: `${notice.body}\n\n${url}`,
      html: `<p>${escape(notice.body)}</p><p><a href="${escape(url)}">Abrir no EmpregoSTP</a></p>`,
    });
  }
}
