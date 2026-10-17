import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getHireService } from '@/infrastructure/firebase/hires/createHireService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — confirmar a contratação (E5). Idempotente: uma por candidatura. */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getHireService().markHired(uid, id, { startDate: body.startDate }),
);

export default recruitmentApi(route);
