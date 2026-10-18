import type { NextApiRequest, NextApiResponse } from 'next';

import { logEvent } from '@/infrastructure/observability/logger';
import { matchesCronSecret } from '@/presentation/outbox/createOutboxCronHandler';

/**
 * Cron autenticado por `Bearer CRON_SECRET`, sem dados pessoais na resposta.
 */
export function createCronHandler(name: string, run: () => Promise<unknown>) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
      return;
    }
    if (
      !matchesCronSecret(req.headers.authorization, process.env.CRON_SECRET)
    ) {
      res.status(401).json({ code: 'UNAUTHORIZED' });
      return;
    }
    const start = Date.now();
    try {
      const result = await run();
      logEvent('info', `${name}_completed`, {
        route: `/api/cron/${name}`,
        durationMs: Date.now() - start,
      });
      res.status(200).json({ status: 'processed', result });
    } catch (error) {
      logEvent(
        'error',
        `${name}_failed`,
        { route: `/api/cron/${name}`, errorCode: 'CRON_FAILED' },
        error,
      );
      res.status(503).json({ code: 'CRON_FAILED' });
    }
  };
}
