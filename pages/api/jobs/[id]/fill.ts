import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getJobClosingService } from '@/infrastructure/firebase/jobs/createJobClosingService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — confirmar «preenchida» proposta pelo sistema (F3.8). */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id) =>
  getJobClosingService().confirmFilled(uid, id),
);

export default recruitmentApi(route);
