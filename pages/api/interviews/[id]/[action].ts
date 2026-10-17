import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getInterviewService } from '@/infrastructure/firebase/interviews/createInterviewService';
import { admin } from '@/lib/firebaseAdmin';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/**
 * POST /api/interviews/[id]/{confirm|request-reschedule|reschedule|cancel|complete|no-show|feedback}
 * O lado (candidato ou organização) é decidido no servidor pela entrevista.
 */
const handler = workspaceRoute<unknown>(
  'POST',
  authenticateApiUser,
  async (uid, id, body) => {
    const service = getInterviewService();
    const action = String(body.__action ?? '');
    switch (action) {
      case 'confirm':
        return service.confirm(uid, id);
      case 'request-reschedule':
        return service.requestReschedule(uid, id, body.proposal);
      case 'reschedule':
        return service.reschedule(uid, id, body);
      case 'cancel': {
        const interview = (
          await admin.firestore().collection('interviews').doc(id).get()
        ).data();
        return service.cancel(
          uid,
          id,
          body.reason,
          interview?.candidateUserId === uid ? 'CANDIDATE' : 'ORGANIZATION',
        );
      }
      case 'complete':
        return service.finish(uid, id, 'COMPLETED');
      case 'no-show':
        return service.finish(uid, id, 'NO_SHOW');
      case 'feedback':
        return service.feedback(uid, id, {
          recommendation: body.recommendation,
          notes: body.notes,
        });
      default:
        return {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Ação desconhecida.' },
        } as const;
    }
  },
);

export default function route(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  // A ação vem do caminho, nunca do corpo enviado pelo cliente.
  req.body = {
    ...(req.body && typeof req.body === 'object' ? req.body : {}),
    __action: req.query.action,
  };
  return handler(req, res);
}
