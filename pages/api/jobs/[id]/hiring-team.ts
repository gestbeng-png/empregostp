import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getHiringTeamService } from '@/infrastructure/firebase/hiring/createHiringTeamService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';
import { workspaceRoute } from '@/presentation/applications/workspaceRoute';

/** PATCH — equipa deste recrutamento: responsável, Hiring Manager e participantes (R7/R14/R15). */
const route = workspaceRoute('PATCH', authenticateApiUser, (uid, id, body) =>
  getHiringTeamService().update(uid, id, {
    leadRecruiterId: body.leadRecruiterId,
    hiringManagerId: body.hiringManagerId,
    recruiterIds: body.recruiterIds,
    interviewerIds: body.interviewerIds,
    observerIds: body.observerIds,
    expectedVersion: body.expectedVersion,
  }),
);

export default recruitmentApi(route);
