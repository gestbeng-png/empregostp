import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getMemberOffboardingService } from '@/infrastructure/firebase/hiring/createMemberOffboardingService';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/**
 * PATCH — alterar papel (`role`) ou remover (`remove: true`) um membro.
 * A remoção transfere o que a pessoa tem a cargo para `transferToUserId`
 * (R57/R58); sem destino, só é aceite se não houver nada a transferir.
 */
function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const memberUserId = String(req.query.userId ?? '');
  return workspaceRoute<unknown>(
    'PATCH',
    authenticateApiUser,
    (uid, id, body) =>
      body.remove === true
        ? getMemberOffboardingService().remove(
            uid,
            id,
            memberUserId,
            body.transferToUserId,
          )
        : getTeamService().changeMember(uid, id, memberUserId, {
            role: body.role,
            remove: false,
            assignedJobIds: body.assignedJobIds,
          }),
  )(req, res);
}

export default handler;
