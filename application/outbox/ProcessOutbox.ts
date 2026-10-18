import type { FeatureKey } from '@/domain/feature-flags/flags';
import { validEventPayload } from '@/domain/outbox/events';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';

import type { FeatureFlagReader } from '../marketplace/ports';

export interface OutboxStore {
  due(now: number, limit: number): Promise<readonly string[]>;
  claim(
    id: string,
    now: number,
    leaseId: string,
    leaseMs: number,
  ): Promise<OutboxEvent | undefined>;
  delivered(eventId: string, handler: string): Promise<boolean>;
  markDelivered(
    eventId: string,
    handler: string,
    leaseId: string,
    now: number,
  ): Promise<boolean>;
  finish(eventId: string, leaseId: string, now: number): Promise<boolean>;
  fail(
    eventId: string,
    leaseId: string,
    now: number,
    errorCode: string,
  ): Promise<boolean>;
}
export interface EventHandler {
  name: string;
  eventTypes: readonly string[];
  channel?: 'AI' | 'WHATSAPP' | 'EMAIL_MARKETING';
  /** External providers MUST accept this key. Otherwise delivery after a crash
   * is at-least-once, not exactly-once; a receipt alone cannot fix that gap. */
  deliver(event: OutboxEvent, idempotencyKey: string): Promise<void>;
}
const killSwitch: Readonly<
  Record<NonNullable<EventHandler['channel']>, FeatureKey>
> = {
  AI: 'KILL_AI',
  WHATSAPP: 'KILL_WHATSAPP',
  EMAIL_MARKETING: 'KILL_OUTBOUND_EMAIL_MARKETING',
};
export interface BatchResult {
  claimed: number;
  completed: number;
  failed: number;
  leaseLost: number;
}

export class ProcessOutbox {
  constructor(
    private readonly store: OutboxStore,
    private readonly handlers: readonly EventHandler[],
    private readonly flags: FeatureFlagReader,
    private readonly leaseId: () => string,
    private readonly now: () => number = Date.now,
  ) {
    const names = handlers.map((handler) => handler.name);
    if (
      names.some((name) => !/^[a-z][a-z0-9_]{0,63}$/.test(name)) ||
      new Set(names).size !== names.length
    )
      throw new Error('INVALID_HANDLER_REGISTRY');
  }
  async execute(limit = 20): Promise<BatchResult> {
    const result: BatchResult = {
      claimed: 0,
      completed: 0,
      failed: 0,
      leaseLost: 0,
    };
    const ids = await this.store.due(
      this.now(),
      Math.min(100, Math.max(1, Number.isSafeInteger(limit) ? limit : 20)),
    );
    for (const id of ids) {
      const lease = this.leaseId();
      const event = await this.store.claim(id, this.now(), lease, 120_000);
      if (!event) continue;
      result.claimed++;
      const handlers = this.handlers.filter((handler) =>
        handler.eventTypes.includes(event.type),
      );
      let errorCode: string | undefined;
      let leaseLost = false;
      if (
        event.schemaVersion !== 1 ||
        !validEventPayload(event.type, event.payload)
      )
        errorCode = 'INVALID_EVENT';
      else if (!handlers.length) errorCode = 'HANDLER_NOT_REGISTERED';
      else {
        for (const handler of handlers) {
          try {
            if (await this.store.delivered(id, handler.name)) continue;
            // Check immediately before each outbound effect, not at batch start.
            if (
              handler.channel &&
              (await this.flags.enabled(killSwitch[handler.channel]))
            ) {
              errorCode = 'CHANNEL_DISABLED';
              break;
            }
            await handler.deliver(event, `${event.id}:${handler.name}`);
            if (
              !(await this.store.markDelivered(
                id,
                handler.name,
                lease,
                this.now(),
              ))
            ) {
              leaseLost = true;
              break;
            }
          } catch {
            // Provider messages can contain email/phone/CV data; never persist.
            errorCode = 'HANDLER_FAILED';
            break;
          }
        }
      }
      if (leaseLost) result.leaseLost++;
      else if (errorCode) {
        if (await this.store.fail(id, lease, this.now(), errorCode))
          result.failed++;
        else result.leaseLost++;
      } else if (await this.store.finish(id, lease, this.now()))
        result.completed++;
      else result.leaseLost++;
    }
    return result;
  }
}
