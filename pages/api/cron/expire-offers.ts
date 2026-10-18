import type { NextApiRequest, NextApiResponse } from 'next';

import { ExpireOffers } from '@/application/offers/ExpireOffers';
import type { OfferDateValue } from '@/domain/offers/expiry';
import { FirestoreLifecycleStore } from '@/infrastructure/firebase/marketplace/FirestoreLifecycleStore';
import { logEvent } from '@/infrastructure/observability/logger';
import { admin } from '@/lib/firebaseAdmin';
import { matchesCronSecret } from '@/presentation/outbox/createOutboxCronHandler';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!matchesCronSecret(req.headers.authorization, process.env.CRON_SECRET)) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }
  const cursor = req.body?.cursor;
  if (
    cursor !== undefined &&
    (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,300}$/.test(cursor))
  ) {
    res.status(400).json({ code: 'INVALID_CURSOR' });
    return;
  }
  try {
    const db = admin.firestore();
    let query = db
      .collection('offers')
      .where('v2Status', '==', 'SENT')
      .orderBy('__name__')
      .limit(50);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    const result = await new ExpireOffers(
      new FirestoreLifecycleStore(db),
    ).execute(
      page.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          organizationId:
            typeof data.organizationId === 'string' ? data.organizationId : '',
          version: data.version,
          expiresAt: data.expiresAt as OfferDateValue,
        };
      }),
    );
    res.status(200).json({
      status: 'processed',
      ...result,
      nextCursor: page.size === 50 ? page.docs[49]?.id : null,
    });
  } catch {
    logEvent('error', 'offer_expiry_failed', {
      route: '/api/cron/expire-offers',
      errorCode: 'OFFER_EXPIRY_FAILED',
    });
    res.status(503).json({ code: 'OFFER_EXPIRY_UNAVAILABLE' });
  }
}
