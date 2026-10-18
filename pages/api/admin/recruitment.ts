import type { NextApiRequest, NextApiResponse } from 'next';

import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';
import { logServerError } from '@/lib/serverLog';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
    });
    return;
  }
  try {
    const actor = await requireActiveApiUser(req, res);
    if (!actor) return;
    if (actor.userData.userType !== 'admin') {
      res
        .status(403)
        .json({ error: { code: 'FORBIDDEN', message: 'Sem permissão.' } });
      return;
    }
    const docs = await admin
      .firestore()
      .collection('hires')
      .where('status', '==', 'ACTIVE')
      .limit(100)
      .get();
    res.status(200).json({
      hires: docs.docs.map((doc) => {
        const row = doc.data();
        return {
          id: doc.id,
          applicationId: String(row.applicationId || ''),
          jobId: String(row.jobId || ''),
          organizationId: String(row.organizationId || ''),
          status: 'ACTIVE',
          candidateConfirmation: String(row.candidateConfirmation || 'PENDING'),
        };
      }),
    });
  } catch (error) {
    logServerError('admin.recruitment_read_failed', error);
    res.status(503).json({
      error: {
        code: 'UNAVAILABLE',
        message: 'Não foi possível carregar as contratações.',
      },
    });
  }
}

export default handler;
