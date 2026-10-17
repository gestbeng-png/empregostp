export const OUTBOX_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
  DEAD: 'DEAD',
} as const);
export type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];
export const RETRY_DELAYS_MS = Object.freeze([
  60_000, 300_000, 1_800_000, 7_200_000, 43_200_000,
]);
export interface OutboxEvent {
  id: string;
  type: string;
  schemaVersion: 1;
  payload: Readonly<Record<string, string | number>>;
  status: OutboxStatus;
  attempts: number;
  createdAtMs: number;
  nextAttemptAtMs: number;
  leaseId?: string;
  leaseUntilMs?: number;
  lastErrorCode?: string;
}
export function canClaim(event: OutboxEvent, now: number): boolean {
  if (
    !Number.isFinite(now) ||
    !Number.isSafeInteger(event.attempts) ||
    event.attempts < 0 ||
    event.attempts > RETRY_DELAYS_MS.length
  )
    return false;
  return (
    ((event.status === 'PENDING' || event.status === 'FAILED') &&
      event.nextAttemptAtMs <= now) ||
    (event.status === 'PROCESSING' &&
      event.leaseUntilMs !== undefined &&
      event.leaseUntilMs <= now)
  );
}
/** Five retries after the initial delivery, then dead-letter. */
export function afterFailure(
  event: OutboxEvent,
  now: number,
): Pick<OutboxEvent, 'status' | 'attempts' | 'nextAttemptAtMs'> {
  const delay = RETRY_DELAYS_MS[event.attempts];
  if (delay === undefined)
    return { status: 'DEAD', attempts: event.attempts, nextAttemptAtMs: now };
  return {
    status: 'FAILED',
    attempts: event.attempts + 1,
    nextAttemptAtMs: now + delay,
  };
}

/** A lease that expired means the worker died mid-delivery (crash, function
 * timeout). It counts as a failed attempt: otherwise an event that always
 * kills the worker is reclaimed forever and never reaches DEAD (D5). */
export const afterLeaseExpired = afterFailure;

/** A kill switch is a deliberate pause, not a delivery failure: the event
 * waits without consuming one of its five attempts. */
export function deferWhileChannelDisabled(
  event: OutboxEvent,
  now: number,
): Pick<OutboxEvent, 'status' | 'attempts' | 'nextAttemptAtMs'> {
  return {
    status: 'FAILED',
    attempts: event.attempts,
    nextAttemptAtMs: now + (RETRY_DELAYS_MS[0] ?? 60_000),
  };
}
