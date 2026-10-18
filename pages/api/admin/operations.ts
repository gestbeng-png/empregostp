import type { NextApiRequest, NextApiResponse } from 'next';

import { getOperationalAlerts } from '@/application/operations/GetOperationalAlerts';
import { FirestoreHealthProbe } from '@/infrastructure/firebase/marketplace/FirestoreHealthProbe';
import { logEvent } from '@/infrastructure/observability/logger';
import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }
  try {
    const principal = await requireActiveApiUser(req, res);
    if (!principal) return;
    if (principal.userData.userType !== 'admin') {
      res.status(403).json({ code: 'FORBIDDEN' });
      return;
    }
    const db = admin.firestore();
    // O processador de emails está sempre ativo: os alertas contam sempre.
    const expected = true;
    const [queue, heartbeat] = await Promise.all([
      new FirestoreHealthProbe(db, async () => true).queue(),
      db.collection('operationalHeartbeats').doc('processOutbox').get(),
    ]);
    const last = heartbeat.data()?.lastSucceededAtMs;
    const snapshot = {
      ...queue,
      lastOutboxRunAtMs:
        typeof last === 'number' && Number.isFinite(last) ? last : null,
    };
    res.status(200).json({
      ...snapshot,
      outboxExpected: expected,
      // 30-minute scheduler plus 15-minute grace; avoid normal waits appearing as outages.
      alerts: getOperationalAlerts(snapshot, Date.now(), expected, 2_700_000),
    });
  } catch (error) {
    logEvent(
      'error',
      'operational_status_failed',
      { route: '/api/admin/operations', errorCode: 'OPERATIONS_UNAVAILABLE' },
      error,
    );
    res.status(503).json({ code: 'OPERATIONS_UNAVAILABLE' });
  }
}

export default handler;
