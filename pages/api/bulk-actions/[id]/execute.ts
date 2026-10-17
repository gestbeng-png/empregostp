import {
  authenticateApiUser,
  getBulkActionService,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — executar depois do período de desfazer. */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id) =>
  getBulkActionService().execute(uid, id),
);

export default recruitmentApi(route);
