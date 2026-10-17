import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** Explicit, authenticated manager action; no tokens in bootstrap responses. */
const route = workspaceRoute('GET', authenticateApiUser, (uid, id) =>
  getTeamService().invitationLink(uid, id),
);

export default recruitmentApi(route);
