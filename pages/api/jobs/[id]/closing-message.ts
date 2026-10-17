import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getJobClosingService } from '@/infrastructure/firebase/jobs/createJobClosingService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — pré-visualizar (`confirm: false`) ou confirmar a mensagem às candidaturas abertas (F2.8/F3.6). */
const route = workspaceRoute<unknown>(
  'POST',
  authenticateApiUser,
  (uid, id, body) =>
    body.confirm === true
      ? getJobClosingService().confirmClosingMessage(uid, id, body.message)
      : getJobClosingService().previewClosingMessage(uid, id, body.message),
);

export default recruitmentApi(route);
