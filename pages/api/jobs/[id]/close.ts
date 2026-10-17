import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getJobClosingService } from '@/infrastructure/firebase/jobs/createJobClosingService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — fechar a vaga com resultado obrigatório (F1.9). */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getJobClosingService().close(uid, id, {
    closeOutcome: body.closeOutcome,
    otherText: body.otherText,
    improvement: body.improvement,
  }),
);

export default recruitmentApi(route);
