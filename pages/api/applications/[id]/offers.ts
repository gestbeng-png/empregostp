import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { FirestoreOfferService } from '@/infrastructure/firebase/offers/FirestoreOfferService';
import { admin } from '@/lib/firebaseAdmin';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
    });
  }
  const method = req.method;
  return workspaceRoute(
    method,
    authenticateApiUser,
    async (uid, id, body) => {
      const db = admin.firestore();
      const service = new FirestoreOfferService(db);
      return method === 'GET'
        ? service.list(uid, id)
        : service.act(uid, id, body);
    },
    200,
  )(req, res);
}
