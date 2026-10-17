import {
  authenticateApiUser,
  getApplicationWorkspace,
  signSnapshotFile,
} from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** GET — URL assinada (5 min) do CV congelado na candidatura; auditado (H4). */
const route = workspaceRoute('GET', authenticateApiUser, (uid, id) =>
  getApplicationWorkspace().cvUrl(uid, id, signSnapshotFile),
);

export default recruitmentApi(route);
