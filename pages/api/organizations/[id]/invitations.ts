import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — convidar membro (E12). */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getTeamService().invite(uid, id, {
    email: body.email,
    role: body.role,
    assignedJobIds: body.assignedJobIds,
    idempotencyKey: body.idempotencyKey,
  }),
);

export default recruitmentApi(route);
