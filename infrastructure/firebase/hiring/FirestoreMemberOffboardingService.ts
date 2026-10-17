import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import {
  reassignInterviewers,
  reassignTeam,
  summarizeResponsibilities,
  validateTransferTarget,
} from '@/domain/hiring/offboarding';
import { readHiringTeam } from '@/domain/hiring/team';
import { canManageMember } from '@/domain/memberships/teamRules';
import type { MemberRole } from '@/domain/memberships/teamRules';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { resolveIdentity } from '../marketplace/FirestoreLifecycleStore';
import { membershipId, validDocumentId } from '../marketplace/identifiers';
import type { FirestoreTeamService } from '../team/FirestoreTeamService';

class Abort extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}
type Plain = Record<string, unknown>;
const ms = (value: unknown): number | null => {
  if (value && typeof value === 'object' && 'toMillis' in value)
    return (value as { toMillis(): number }).toMillis();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

/**
 * R57/R58/R105 — remover um membro transferindo o que tem a cargo, numa só
 * transação: nada fica órfão nem a meio. O acesso termina no pedido seguinte
 * porque a identidade é relida a cada pedido (membership REMOVED).
 */
export class FirestoreMemberOffboardingService {
  constructor(
    private readonly db: Firestore,
    private readonly team: Pick<FirestoreTeamService, 'roleOf'>,
    private readonly now: () => number = Date.now,
  ) {}

  async remove(
    userId: string,
    organizationId: string,
    memberUserId: string,
    transferToUserId?: unknown,
  ): Promise<
    Result<{
      removed: true;
      transferredTo: string | null;
      leadJobs: number;
      applications: number;
      interviews: number;
    }>
  > {
    if (
      !validDocumentId(organizationId) ||
      !validDocumentId(memberUserId) ||
      (transferToUserId != null &&
        transferToUserId !== '' &&
        !validDocumentId(transferToUserId))
    )
      return failure('INVALID_INPUT');
    const targetId =
      typeof transferToUserId === 'string' && transferToUserId
        ? transferToUserId
        : null;
    const [actorRole, memberRole, targetRole] = await Promise.all([
      this.team.roleOf(userId, organizationId),
      this.team.roleOf(memberUserId, organizationId),
      targetId ? this.team.roleOf(targetId, organizationId) : null,
    ]);
    if (!actorRole || !memberRole) return failure('NOT_FOUND');
    if (
      !canManageMember(
        { userId, role: actorRole },
        { userId: memberUserId, role: memberRole },
      )
    )
      return failure('FORBIDDEN');
    // Para saber em que vagas quem recebe precisa de passar a ter acesso.
    const target = targetId
      ? await resolveIdentity(
          this.db,
          { get: (ref: { get(): unknown }) => ref.get() } as never,
          targetId,
          organizationId,
        )
      : null;
    const canView = (jobId: string) =>
      Boolean(
        target &&
        can(target.permission, 'view_application', {
          organizationId,
          jobId,
        }),
      );

    const membershipRef = this.db
      .collection('organizationMemberships')
      .doc(membershipId(memberUserId, organizationId));
    try {
      const result = await this.db.runTransaction(async (tx) => {
        // Todas as leituras antes de qualquer escrita (regra do Firestore).
        const [membership, processes, assignments, interviews] =
          await Promise.all([
            tx.get(membershipRef),
            tx.get(
              this.db
                .collection('hiringProcesses')
                .where('organizationId', '==', organizationId)
                .where('memberIds', 'array-contains', memberUserId)
                .limit(200),
            ),
            tx.get(
              this.db
                .collection('applicationAssignments')
                .where('organizationId', '==', organizationId)
                .where('userId', '==', memberUserId)
                .limit(500),
            ),
            tx.get(
              this.db
                .collection('interviews')
                .where('organizationId', '==', organizationId)
                .where('interviewerUserIds', 'array-contains', memberUserId)
                .limit(200),
            ),
          ]);
        if (!membership.exists && memberRole !== 'OWNER')
          throw new Abort('NOT_FOUND');
        const apps = await Promise.all(
          assignments.docs.map((doc) =>
            tx.get(this.db.collection('applications').doc(doc.id)),
          ),
        );
        const statusOf = new Map(
          apps.map((doc) => [doc.id, String(doc.data()?.v2Status ?? '')]),
        );
        const now = this.now();
        const responsibilities = summarizeResponsibilities(memberUserId, {
          processes: processes.docs.map((doc) => ({
            jobId: doc.id,
            members: readHiringTeam(doc.data()).members,
          })),
          assignments: assignments.docs.map((doc) => ({
            applicationId: doc.id,
            userId: String(doc.data().userId ?? ''),
            applicationStatus: statusOf.get(doc.id) ?? '',
          })),
          interviews: interviews.docs.map((doc) => ({
            id: doc.id,
            status: String(doc.data().v2Status ?? ''),
            startsAt: ms(doc.data().startsAt),
            interviewerUserIds: strings(doc.data().interviewerUserIds),
          })),
          now,
        });
        const valid = validateTransferTarget(memberUserId, responsibilities, {
          userId: targetId,
          role: targetRole as MemberRole | null,
        });
        if (!valid.ok) throw new Abort(valid.error.code, valid.error.message);
        const recipient = valid.value;

        // Vagas herdadas fora de qualquer equipa existente: quem recebe tem
        // de ganhar acesso — lê-se (ou cria-se) a equipa dessa vaga.
        const jobOf = (data: Plain) => String(data.jobId ?? '');
        const inherited = new Set<string>([
          ...assignments.docs
            .filter((doc) =>
              responsibilities.assignedApplicationIds.includes(doc.id),
            )
            .map((doc) => jobOf(doc.data())),
          ...interviews.docs
            .filter((doc) =>
              responsibilities.upcomingInterviewIds.includes(doc.id),
            )
            .map((doc) => jobOf(doc.data())),
        ]);
        const known = new Set(processes.docs.map((doc) => doc.id));
        const extraJobs = recipient
          ? [...inherited].filter(
              (jobId) => jobId && !known.has(jobId) && !canView(jobId),
            )
          : [];
        const extra = await Promise.all(
          extraJobs.map((jobId) =>
            tx.get(this.db.collection('hiringProcesses').doc(jobId)),
          ),
        );

        const at = Timestamp.fromMillis(now);
        const writeTeam = (
          ref: DocumentReference,
          stored: Plain | undefined,
          jobId: string,
        ) => {
          const members = reassignTeam(
            readHiringTeam(stored).members,
            memberUserId,
            recipient,
            Boolean(recipient) && inherited.has(jobId) && !canView(jobId),
          );
          const team = readHiringTeam({ members });
          const wasMember = strings(stored?.memberIds).includes(
            recipient ?? '',
          );
          tx.set(ref, {
            organizationId,
            jobId,
            status: typeof stored?.status === 'string' ? stored.status : 'OPEN',
            openedAt: stored?.openedAt ?? at,
            leadRecruiterId: team.leadRecruiterId,
            hiringManagerId: team.hiringManagerId,
            members: members.map((member) => {
              const kept = (stored?.members as Plain[] | undefined)?.find(
                (entry) =>
                  entry.userId === member.userId && entry.role === member.role,
              );
              return {
                ...member,
                assignedBy: kept?.assignedBy ?? userId,
                assignedAt: kept?.assignedAt ?? at,
              };
            }),
            memberIds: team.memberIds,
            version: (Number(stored?.version) || 0) + 1,
            createdAt: stored?.createdAt ?? at,
            updatedAt: at,
            updatedBy: userId,
          });
          if (
            recipient &&
            recipient !== userId &&
            !wasMember &&
            team.memberIds.includes(recipient)
          )
            tx.create(this.db.collection('outboxEvents').doc(), {
              type: 'hiring_team_assigned',
              schemaVersion: 1,
              payload: { jobId, userId: recipient },
              status: 'PENDING',
              attempts: 0,
              createdAtMs: now,
              nextAttemptAtMs: now,
            });
        };
        processes.docs.forEach((doc) => writeTeam(doc.ref, doc.data(), doc.id));
        extra.forEach((doc) => writeTeam(doc.ref, doc.data(), doc.id));

        for (const doc of assignments.docs) {
          if (!responsibilities.assignedApplicationIds.includes(doc.id))
            continue;
          tx.set(doc.ref, {
            ...doc.data(),
            userId: recipient,
            previousUserId: memberUserId,
            assignedBy: userId,
            assignedAt: at,
            version: (Number(doc.data().version) || 0) + 1,
          });
        }
        for (const doc of interviews.docs) {
          if (
            !responsibilities.upcomingInterviewIds.includes(doc.id) ||
            !recipient
          )
            continue;
          tx.update(doc.ref, {
            interviewerUserIds: reassignInterviewers(
              strings(doc.data().interviewerUserIds),
              memberUserId,
              recipient,
            ),
            version: (Number(doc.data().version) || 0) + 1,
            updatedAt: at,
            updatedBy: userId,
          });
        }
        if (membership.exists)
          tx.update(membershipRef, {
            status: 'REMOVED',
            removedBy: userId,
            removedAtMs: now,
          });
        // R71/R58: auditoria só com ids e contagens; a autoria histórica
        // (notas, decisões) não é tocada.
        tx.create(this.db.collection('auditLogs').doc(), {
          actorId: userId,
          actorType: 'EMPLOYER',
          action: 'team_member_removed',
          resourceType: 'OrganizationMembership',
          resourceId: memberUserId,
          organizationId,
          metadata: {
            transferredTo: recipient,
            leadJobs: responsibilities.leadJobIds.length,
            supportJobs: responsibilities.supportJobIds.length,
            applications: responsibilities.assignedApplicationIds.length,
            interviews: responsibilities.upcomingInterviewIds.length,
          },
          at,
        });
        return {
          removed: true as const,
          transferredTo: recipient,
          leadJobs: responsibilities.leadJobIds.length,
          applications: responsibilities.assignedApplicationIds.length,
          interviews: responsibilities.upcomingInterviewIds.length,
        };
      });
      return success(result);
    } catch (error) {
      if (error instanceof Abort) return failure(error.code, error.message);
      throw error;
    }
  }
}
