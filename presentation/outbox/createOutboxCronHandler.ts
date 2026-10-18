import { randomUUID, timingSafeEqual } from 'node:crypto';

import type { NextApiHandler } from 'next';

import type { BatchResult } from '@/application/outbox/ProcessOutbox';
import { logEvent } from '@/infrastructure/observability/logger';

export interface OutboxCronRuntime {
  process(): Promise<BatchResult>;
  heartbeat(
    now: number,
    durationMs: number,
    result: BatchResult,
  ): Promise<void>;
}
export function matchesCronSecret(
  provided: unknown,
  secret: string | undefined,
): boolean {
  if (
    !secret ||
    typeof provided !== 'string' ||
    !provided.startsWith('Bearer ')
  )
    return false;
  const actual = Buffer.from(provided.slice(7));
  const expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Authentication happens before creating a runtime or touching Firebase.
 * No caller-selected batch. */
export function createOutboxCronHandler(
  runtime: () => OutboxCronRuntime,
  options: {
    secret: () => string | undefined;
    now?: () => number;
  },
): NextApiHandler {
  return async (req, res): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
      return;
    }
    if (!matchesCronSecret(req.headers.authorization, options.secret())) {
      res.status(401).json({ code: 'UNAUTHORIZED' });
      return;
    }
    const now = options.now ?? Date.now;
    const start = now();
    const requestId = randomUUID();
    try {
      const runner = runtime();
      const result = await runner.process();
      await runner.heartbeat(now(), now() - start, result);
      logEvent('info', 'outbox_batch_completed', {
        requestId,
        route: '/api/cron/process-outbox',
        durationMs: now() - start,
      });
      res.status(200).json({ status: 'processed', ...result });
    } catch (error) {
      logEvent(
        'error',
        'outbox_batch_failed',
        {
          requestId,
          route: '/api/cron/process-outbox',
          durationMs: now() - start,
          errorCode: 'OUTBOX_BATCH_FAILED',
        },
        error,
      );
      res.status(503).json({ code: 'OUTBOX_UNAVAILABLE' });
    }
  };
}
