import {
  authenticateApiUser,
  getApplicationWorkspace,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** GET — candidatura vista pela organização (snapshot, histórico, notas). */
const route = workspaceRoute('GET', authenticateApiUser, (uid, id) =>
  getApplicationWorkspace().view(uid, id),
);

export default recruitmentApi(route);
