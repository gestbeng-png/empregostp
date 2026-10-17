import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — o ADMIN escolhido aceita; o antigo OWNER passa a ADMIN. */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id) =>
  getTeamService().acceptOwnershipTransfer(uid, id),
);

export default recruitmentApi(route);
