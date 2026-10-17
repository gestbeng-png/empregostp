import type { NextApiHandler } from 'next';

import { checkHealth } from '@/application/health/CheckHealth';
import type { HealthProbe } from '@/application/health/CheckHealth';

export function createHealthHandler(probe: () => HealthProbe): NextApiHandler {
  return async (req, res): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ status: 'method_not_allowed' }); return; }
    try {
      const report = await checkHealth(probe());
      // Public liveness never discloses storage/project/queue/customer details.
      res.status(report.status === 'ok' ? 200 : 503).json({ status: report.status });
    } catch { res.status(503).json({ status: 'degraded' }); }
  };
}
