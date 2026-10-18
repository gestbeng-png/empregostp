import {
  authenticateApiUser,
  getBulkActionService,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — preparar ação em lote (contagem, mensagem, 10 s para desfazer). */
const route = workspaceRoute('POST', authenticateApiUser, (uid, _id, body) =>
  getBulkActionService().prepare(uid, body),
);

export default route;
