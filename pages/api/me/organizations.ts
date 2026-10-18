import { success } from '@/domain/shared/Result';
import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getTeamService } from '@/infrastructure/firebase/team/createTeamService';
import { organizationLabels } from '@/infrastructure/firebase/team/organizationLabels';
import { admin } from '@/lib/firebaseAdmin';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** GET — organizações do utilizador para o seletor do painel (D6). */
const route = workspaceRoute('GET', authenticateApiUser, async (uid) =>
  success({
    organizations: await organizationLabels(
      admin.firestore(),
      await getTeamService().myOrganizations(uid),
    ),
  }),
);

export default route;
