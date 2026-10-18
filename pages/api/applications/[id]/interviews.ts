import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getInterviewService } from '@/infrastructure/firebase/interviews/createInterviewService';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — marcar entrevista (E6); requer `Idempotency-Key` no corpo ou cabeçalho. */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getInterviewService().schedule(
    uid,
    id,
    body,
    String(body.idempotencyKey ?? ''),
  ),
);

export default route;
