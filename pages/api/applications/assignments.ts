import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getApplicationAssignmentService } from '@/infrastructure/firebase/hiring/createApplicationAssignmentService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — responsável pela análise de 1 a 100 candidaturas (R24/R25/R88); `assigneeUserId: null` devolve à fila. */
const route = workspaceRoute(
  'POST',
  authenticateApiUser,
  (uid, _id, body) =>
    getApplicationAssignmentService().assign(uid, {
      organizationId: body.organizationId,
      applicationIds: body.applicationIds,
      assigneeUserId: body.assigneeUserId,
    }),
  200,
);

export default recruitmentApi(route);
