import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getHireService } from '@/infrastructure/firebase/hires/createHireService';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** POST — anulação pelo admin, com motivo e auditoria (E4). */
const route = workspaceRoute('POST', authenticateApiUser, (uid, id, body) =>
  getHireService().annul(uid, id, body.reason),
);

export default route;
