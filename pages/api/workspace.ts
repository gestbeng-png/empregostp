import type { NextApiRequest, NextApiResponse } from 'next';

import { success } from '@/domain/shared/Result';
import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { readRecruitmentWorkspace } from '@/infrastructure/firebase/applications/readRecruitmentWorkspace';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { organizationLabels } from '@/infrastructure/firebase/team/organizationLabels';
import { admin } from '@/lib/firebaseAdmin';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  return workspaceRoute<unknown>('GET', authenticateApiUser, async (uid) => {
    const organizations = await getTeamService().myOrganizations(uid);
    const organizationId =
      typeof req.query.organizationId === 'string'
        ? req.query.organizationId
        : organizations[0]?.organizationId;
    if (!organizationId) return success({ organizations, workspace: null });
    const db = admin.firestore();
    const result = await readRecruitmentWorkspace(
      db,
      uid,
      organizationId,
      organizations,
    );
    return result.ok
      ? success({
          organizations: await organizationLabels(db, organizations),
          workspace: result.value,
        })
      : result;
  })(req, res);
}

export default handler;
