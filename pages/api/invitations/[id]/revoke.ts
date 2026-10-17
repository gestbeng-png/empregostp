import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — revogar convite pendente (OWNER/ADMIN). */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id) =>
  getTeamService().revoke(uid, id),
);

export default recruitmentApi(route);
