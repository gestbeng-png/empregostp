import type { Firestore } from 'firebase-admin/firestore';

import { canUseFeature } from '@/domain/entitlements/canUseFeature';
import { buildWorkload } from '@/domain/hiring/assignment';
import type { WorkloadRow } from '@/domain/hiring/assignment';
import {
  needsTransfer,
  summarizeResponsibilities,
} from '@/domain/hiring/offboarding';
import type {
  ClosingSummary,
  RecruitmentOverview,
} from '@/domain/hiring/overview';
import {
  buildRecruitmentOverview,
  isNewApplication,
  isStaleApplication,
  summarizeOpenApplications,
} from '@/domain/hiring/overview';
import { canManageHiringTeam, readHiringTeam } from '@/domain/hiring/team';
import type { HiringTeamMember } from '@/domain/hiring/team';
import { candidateInterviewView } from '@/domain/interviews/schedule';
import type { CandidateInterviewView } from '@/domain/interviews/schedule';
import type { MemberRole } from '@/domain/memberships/teamRules';
import { can } from '@/domain/permissions/can';
import type { PermissionAction } from '@/domain/permissions/can';
import { success, failure } from '@/domain/shared/Result';
import type { Result } from '@/domain/shared/Result';

import { activeOrganizationMemberIds } from '../hiring/FirestoreHiringTeamService';
import { resolveIdentity } from '../marketplace/FirestoreLifecycleStore';

type Plain = Record<string, unknown>;
export interface RecruitmentWorkspaceView {
  organizationId: string;
  role: MemberRole;
  userId: string;
  limit: number;
  capabilities: {
    manageTeam: boolean;
  };
  applications: {
    id: string;
    jobId: string;
    title: string;
    candidateName: string;
    status: string;
    version: number;
    submittedAt: string | null;
    /** R21: recebida e ainda nunca aberta por ninguém da organização. */
    isNew: boolean;
    /** R16: por analisar há mais de 10 dias. */
    isStale: boolean;
    /** R24: responsável pela análise (null = fila comum). */
    assigneeUserId: string | null;
    assigneeName: string | null;
    permissions: {
      transition: boolean;
      notes: boolean;
      cv: boolean;
      hire: boolean;
      interview: boolean;
    };
  }[];
  jobs: {
    id: string;
    title: string;
    status: string;
    fillProposed: boolean;
    closingPending: boolean;
    canClose: boolean;
    applicationDeadline: string | null;
    /** R91: o que fica por resolver se fechar agora. */
    closingSummary: ClosingSummary;
    /** R7/R14/R15: equipa deste recrutamento (vazia até ser definida). */
    hiringTeam: {
      version: number;
      leadRecruiterId: string | null;
      hiringManagerId: string | null;
      members: (HiringTeamMember & { name: string })[];
      canManage: boolean;
    };
  }[];
  /** R16: números reais e o que precisa de atenção. */
  overview: RecruitmentOverview;
  /** R25: carga por pessoa (só para OWNER/ADMIN; nunca um ranking). */
  workload: { rows: WorkloadRow[]; unassignedToReview: number } | null;
  /** Membros ativos que podem integrar equipas de vaga (só para quem gere). */
  teamCandidates: { userId: string; name: string; role: string }[];
  interviews: (CandidateInterviewView & {
    applicationId: string;
    canManage: boolean;
    canFeedback: boolean;
  })[];
  members: {
    userId: string;
    role: string;
    name: string;
    email: string;
    assignedJobIds: string[];
    /** R57: o que tem a cargo (para remover com transferência). */
    responsibilities: {
      leadJobs: number;
      supportJobs: number;
      applications: number;
      interviews: number;
      mustTransfer: boolean;
    };
  }[];
  team: {
    inviteConfigured: boolean;
    emailProcessorEnabled: boolean;
    usedSeats: number;
    seatLimit: number | null;
  };
  invitations: {
    id: string;
    email: string;
    role: string;
    expiresAt: string | null;
  }[];
  ownershipTransfer: { canAccept: boolean } | null;
}
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const iso = (value: unknown): string | null => {
  const date =
    value && typeof value === 'object' && 'toDate' in value
      ? (value as { toDate(): Date }).toDate()
      : value;
  return date instanceof Date
    ? date.toISOString()
    : typeof date === 'string'
      ? date
      : null;
};

/** Read-only bootstrap. Every list is organization-scoped and projected by allowlist. */
export async function readRecruitmentWorkspace(
  db: Firestore,
  uid: string,
  organizationId: string,
  organizations: { organizationId: string; role: MemberRole }[],
): Promise<Result<RecruitmentWorkspaceView>> {
  const selected = organizations.find(
    (item) => item.organizationId === organizationId,
  );
  if (!selected) return failure('FORBIDDEN');
  const identity = await resolveIdentity(
    db,
    { get: (ref: { get(): unknown }) => ref.get() } as never,
    uid,
    organizationId,
  );
  if (!identity) return failure('FORBIDDEN');
  if (
    !can(identity.permission, 'view_application', {
      organizationId,
      jobId: '__bootstrap__',
    }) &&
    identity.permission.role !== 'RECRUITER'
  )
    return failure('FORBIDDEN');
  const resource = (jobId?: string) => ({ organizationId, jobId });
  const allowed = (action: PermissionAction, jobId?: string) =>
    can(identity.permission, action, resource(jobId));
  const manageTeam = allowed('manage_members');
  const list = async (collection: string, field = 'organizationId') =>
    (
      await db
        .collection(collection)
        .where(field, '==', organizationId)
        .limit(100)
        .get()
    ).docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Plain);
  const [
    apps,
    jobsByOrganization,
    jobsByCompany,
    interviews,
    members,
    invitations,
    transfer,
    hiringProcesses,
    feedback,
    offers,
    activeIds,
    assignments,
  ] = await Promise.all([
    list('applications'),
    list('jobs'),
    list('jobs', 'companyId'),
    list('interviews'),
    manageTeam ? list('organizationMemberships') : [],
    manageTeam ? list('organizationInvitations') : [],
    manageTeam
      ? db.collection('ownershipTransfers').doc(organizationId).get()
      : null,
    list('hiringProcesses'),
    list('interviewFeedback'),
    list('offers'),
    activeOrganizationMemberIds(db, organizationId),
    list('applicationAssignments'),
  ]);
  const permissions = (jobId: string) => ({
    transition: allowed('change_application_status', jobId),
    notes: allowed('internal_notes', jobId),
    cv: allowed('download_application_cv', jobId),
    hire: allowed('confirm_hire', jobId),
    interview: allowed('interview_offer', jobId),
  });
  const visible = (row: Plain) =>
    allowed('view_application', text(row.jobId || row.id));
  const transferData = transfer?.data();
  const activeMembers = members.filter((row) => row.status === 'ACTIVE');
  const activeInvitations = invitations.filter(
    (row) =>
      row.v2Status === 'PENDING' &&
      (!iso(row.expiresAt) ||
        Date.parse(iso(row.expiresAt) || '') > Date.now()),
  );
  if (manageTeam && !activeMembers.some((row) => row.role === 'OWNER')) {
    const organization = (
      await db.collection('organizations').doc(organizationId).get()
    ).data();
    const ownerId = text(organization?.ownerUserId) || organizationId;
    const owner = (await db.collection('users').doc(ownerId).get()).data();
    if (owner?.userType === 'empresa')
      activeMembers.unshift({ userId: ownerId, role: 'OWNER' });
  }
  const memberViews = await Promise.all(
    activeMembers.map(async (row) => {
      const userId = text(row.userId);
      const user = (await db.collection('users').doc(userId).get()).data();
      return {
        userId,
        role: text(row.role),
        name: text(user?.name || user?.displayName || user?.companyName),
        email: text(user?.email),
        assignedJobIds: Array.isArray(row.assignedJobIds)
          ? row.assignedJobIds.filter(
              (id): id is string => typeof id === 'string',
            )
          : [],
      };
    }),
  );
  const now = Date.now();
  const visibleApps = apps.filter(
    (row) => typeof row.v2Status === 'string' && visible(row),
  );
  const appView = (row: Plain) => ({
    jobId: text(row.jobId),
    status: text(row.v2Status),
    submittedAt: iso(row.submittedAt),
    firstViewedAt: iso(row.firstViewedAt),
    lastStatusChangeAt: iso(row.lastStatusChangeAt),
  });
  const jobRows = [
    ...new Map(
      [...jobsByOrganization, ...jobsByCompany].map((row) => [row.id, row]),
    ).values(),
  ].filter(visible);
  const deadlineOf = (row: Plain) =>
    iso(row.applicationDeadline) ||
    (typeof row.dataFecho === 'string' && row.dataFecho
      ? `${row.dataFecho}T23:59:59Z`
      : null);
  const teams = new Map(
    hiringProcesses.map((row) => [text(row.jobId || row.id), row]),
  );
  // Nomes: os dos membros já lidos; para quem não gere a organização, só os
  // das equipas — ou todos os membros ativos se lidera alguma equipa (R14:
  // o responsável pode gerir a equipa da sua vaga).
  const names = new Map(memberViews.map((row) => [row.userId, row.name]));
  const leadsSomeTeam = hiringProcesses.some(
    (row) => readHiringTeam(row, activeIds).leadRecruiterId === uid,
  );
  const assigneeOf = new Map(
    assignments
      .filter(
        (row) => typeof row.userId === 'string' && activeIds.has(row.userId),
      )
      .map((row) => [text(row.applicationId || row.id), text(row.userId)]),
  );
  const teamUserIds = [
    ...new Set([
      ...assigneeOf.values(),
      ...hiringProcesses.flatMap((row) =>
        Array.isArray(row.memberIds)
          ? row.memberIds.filter((id): id is string => typeof id === 'string')
          : [],
      ),
      ...(leadsSomeTeam ? activeIds : []),
    ]),
  ].filter((id) => !names.has(id) && activeIds.has(id));
  await Promise.all(
    teamUserIds.slice(0, 50).map(async (id) => {
      const user = (await db.collection('users').doc(id).get()).data();
      names.set(
        id,
        text(user?.name || user?.displayName || user?.companyName) ||
          'Membro da equipa',
      );
    }),
  );
  const feedbackByInterview = new Set(
    feedback.map((row) => text(row.interviewId)),
  );
  const memberRole = selected.role;

  return success({
    organizationId,
    role: selected.role,
    userId: uid,
    limit: 100,
    capabilities: {
      manageTeam,
    },
    applications: visibleApps.map((row) => {
      const view = appView(row);
      return {
        id: text(row.id),
        jobId: text(row.jobId),
        title: text(row.jobTitle) || text((row.jobSnapshot as Plain)?.titulo),
        candidateName:
          text((row.candidateSnapshot as Plain)?.fullName) ||
          text(row.candidateName),
        status: text(row.v2Status),
        version: Number(row.version) || 0,
        submittedAt: view.submittedAt,
        isNew: isNewApplication(view),
        isStale: isStaleApplication(view, now),
        assigneeUserId: assigneeOf.get(text(row.id)) ?? null,
        assigneeName: assigneeOf.has(text(row.id))
          ? names.get(assigneeOf.get(text(row.id)) as string) ||
            'Membro da equipa'
          : null,
        permissions: permissions(text(row.jobId)),
      };
    }),
    jobs: jobRows.map((row) => {
      const jobId = text(row.id);
      const stored = teams.get(jobId);
      const team = readHiringTeam(stored, activeIds);
      return {
        id: jobId,
        title: text(row.titulo || row.title),
        status: text(row.v2Status || row.status),
        fillProposed: Boolean(row.fillProposedAt),
        closingPending: row.jobEndPending === true,
        canClose: allowed('publish_close_job', jobId),
        applicationDeadline: deadlineOf(row),
        closingSummary: summarizeOpenApplications(
          visibleApps
            .filter((app) => text(app.jobId) === jobId)
            .map((app) => ({ status: text(app.v2Status) })),
        ),
        hiringTeam: {
          version: Number(stored?.version) || 0,
          leadRecruiterId: team.leadRecruiterId,
          hiringManagerId: team.hiringManagerId,
          members: team.members.map((member) => ({
            ...member,
            name: names.get(member.userId) || 'Membro da equipa',
          })),
          canManage: canManageHiringTeam(
            { userId: uid, role: memberRole },
            team.leadRecruiterId,
          ),
        },
      };
    }),
    overview: buildRecruitmentOverview({
      now,
      applications: visibleApps.map(appView),
      interviews: interviews.filter(visible).map((row) => ({
        status: text(row.v2Status),
        startsAt: iso(row.startsAt),
        hasFeedback: feedbackByInterview.has(text(row.id)),
      })),
      jobs: jobRows.map((row) => ({
        id: text(row.id),
        status: text(row.v2Status || row.status),
        applicationDeadline: deadlineOf(row),
      })),
      offers: offers.filter(visible).map((row) => ({
        status: text(row.v2Status),
        expiresAt: iso(row.expiresAt),
      })),
    }),
    workload:
      memberRole === 'OWNER' || memberRole === 'ADMIN'
        ? buildWorkload(
            visibleApps.map((row) => ({
              status: text(row.v2Status),
              assigneeUserId: assigneeOf.get(text(row.id)) ?? null,
            })),
            [...activeIds].map((userId) => ({
              userId,
              name: names.get(userId) || 'Membro da equipa',
            })),
          )
        : null,
    teamCandidates:
      memberRole === 'OWNER' || memberRole === 'ADMIN' || leadsSomeTeam
        ? [...activeIds].map((userId) => ({
            userId,
            name:
              names.get(userId) ||
              memberViews.find((row) => row.userId === userId)?.email ||
              'Membro da equipa',
            role: memberViews.find((row) => row.userId === userId)?.role || '',
          }))
        : [],
    interviews: interviews.filter(visible).map((row) => ({
      ...candidateInterviewView(row),
      applicationId: text(row.applicationId),
      canManage: allowed('interview_offer', text(row.jobId)),
      canFeedback: allowed('internal_notes', text(row.jobId)),
    })),
    members: memberViews.map((member) => {
      const r = summarizeResponsibilities(member.userId, {
        now,
        processes: hiringProcesses.map((row) => ({
          jobId: text(row.jobId || row.id),
          members: readHiringTeam(row).members,
        })),
        assignments: assignments.map((row) => ({
          applicationId: text(row.applicationId || row.id),
          userId: typeof row.userId === 'string' ? row.userId : null,
          applicationStatus: text(
            apps.find((app) => app.id === text(row.applicationId || row.id))
              ?.v2Status,
          ),
        })),
        interviews: interviews.map((row) => ({
          id: text(row.id),
          status: text(row.v2Status),
          startsAt: iso(row.startsAt)
            ? Date.parse(iso(row.startsAt) as string)
            : null,
          interviewerUserIds: Array.isArray(row.interviewerUserIds)
            ? row.interviewerUserIds.filter(
                (id): id is string => typeof id === 'string',
              )
            : [],
        })),
      });
      return {
        ...member,
        responsibilities: {
          leadJobs: r.leadJobIds.length,
          supportJobs: r.supportJobIds.length,
          applications: r.assignedApplicationIds.length,
          interviews: r.upcomingInterviewIds.length,
          mustTransfer: needsTransfer(r),
        },
      };
    }),
    team: {
      inviteConfigured: Boolean(process.env.TEAM_INVITE_SECRET?.trim()),
      emailProcessorEnabled: true,
      usedSeats: memberViews.length + activeInvitations.length,
      seatLimit: canUseFeature(
        { type: 'ORGANIZATION', id: organizationId },
        'SEATS',
        [],
        { now: Date.now() },
      ).limit,
    },
    invitations: activeInvitations.map((row) => ({
      id: text(row.id),
      email: text(row.email),
      role: text(row.role),
      expiresAt: iso(row.expiresAt),
    })),
    ownershipTransfer:
      transferData?.status === 'PENDING' &&
      transferData.toUserId === uid &&
      Number(transferData.expiresAtMs) > Date.now()
        ? { canAccept: true }
        : null,
  });
}
