import {
  authenticateApiUser,
  getApplicationWorkspace,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — nota interna (F3.5); nunca visível ao candidato. */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getApplicationWorkspace().addNote(uid, id, body.body),
);

export default route;
