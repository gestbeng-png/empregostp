import type { NextApiRequest, NextApiResponse } from 'next';

import { failure } from '@/domain/shared/Result';
import {
  authenticateWithEmail,
  getTeamService,
} from '@/infrastructure/firebase/team/createTeamService';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** Read-only preview with the invitation token in the body, not access logs. */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let user: Awaited<ReturnType<typeof authenticateWithEmail>> = null;
  return workspaceRoute(
    'POST',
    async (request, response) => {
      user = await authenticateWithEmail(request, response);
      return user;
    },
    async (_uid, id, body) =>
      user
        ? getTeamService().previewInvitation(user, id, body.token)
        : Promise.resolve(failure('FORBIDDEN')),
    200,
  )(req, res);
}

export default handler;
