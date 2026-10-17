import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getHireService } from '@/infrastructure/firebase/hires/createHireService';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — resposta do candidato: CONFIRMED ou DISPUTED (E5.3). */
export default workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getHireService().candidateRespond(uid, id, body.answer),
);
