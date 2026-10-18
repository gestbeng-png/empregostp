import {
  authenticateApiUser,
  getBulkActionService,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — desfazer (só enquanto pendente). */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id) =>
  getBulkActionService().cancel(uid, id),
);

export default route;
