import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — o OWNER propõe transferir a propriedade a um ADMIN ativo. */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getTeamService().requestOwnershipTransfer(
    uid,
    id,
    String(body.targetUserId ?? ''),
  ),
);

export default route;
