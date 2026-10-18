import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import {
  buildHiringTeam,
  canManageHiringTeam,
  readHiringTeam,
} from '@/domain/hiring/team';
import type { HiringTeamInput } from '@/domain/hiring/team';
import { readJobLifecycle } from '@/domain/jobs/legacyView';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { validDocumentId } from '../marketplace/identifiers';
import type { FirestoreTeamService } from '../team/FirestoreTeamService';

class Abort extends Error {
  constructor(readonly code: DomainErrorCode) {
    super(code);
  }
}

/**
 * Membros ativos da organização, incluindo o OWNER legado (1 utilizador = 1
 * empresa) enquanto não houver membership para ele (D6/D7).
 */
export async function activeOrganizationMemberIds(
  db: Firestore,
  organizationId: string,
): Promise<Set<string>> {
  const snapshot = await db
    .collection('organizationMemberships')
    .where('organizationId', '==', organizationId)
    .limit(200)
    .get();
  const ids = new Set(
    snapshot.docs
      .map((doc) => doc.data())
      .filter(
        (row) => row.status === 'ACTIVE' && typeof row.userId === 'string',
      )
      .map((row) => row.userId as string),
  );
  const hasOwner = snapshot.docs.some(
    (doc) => doc.data().status === 'ACTIVE' && doc.data().role === 'OWNER',
  );
  if (!hasOwner) {
    const organization = (
      await db.collection('organizations').doc(organizationId).get()
    ).data();
    ids.add(
      typeof organization?.ownerUserId === 'string'
        ? organization.ownerUserId
        : organizationId,
    );
  }
  return ids;
}

/**
 * R7/R14/R15/R63 — equipa de um recrutamento, guardada em
 * `hiringProcesses/{jobId}` (1 processo por vaga nesta versão; ADR-017).
 * Só a escrita passa aqui; a leitura vem no bootstrap do espaço de trabalho.
 */
export class FirestoreHiringTeamService {
  constructor(
    private readonly db: Firestore,
    private readonly team: Pick<FirestoreTeamService, 'roleOf'>,
    private readonly now: () => number = Date.now,
  ) {}

  async update(
    userId: string,
    jobId: string,
    input: HiringTeamInput & { expectedVersion?: unknown },
  ): Promise<Result<{ version: number; memberIds: string[] }>> {
    if (!validDocumentId(jobId)) return failure('NOT_FOUND');
    const jobRef = this.db.collection('jobs').doc(jobId);
    const job = (await jobRef.get()).data();
    if (!job) return failure('NOT_FOUND');
    const organizationId = readJobLifecycle(job).organizationId;
    if (!organizationId) return failure('NOT_FOUND');
    const role = await this.team.roleOf(userId, organizationId);
    // Quem não é da organização nem sabe que a vaga existe (D14).
    if (!role) return failure('NOT_FOUND');
    const activeIds = await activeOrganizationMemberIds(
      this.db,
      organizationId,
    );
    const next = buildHiringTeam(input, activeIds);
    if (!next.ok) return next;
    const expected =
      input.expectedVersion === undefined
        ? null
        : Number(input.expectedVersion);
    if (expected !== null && !Number.isInteger(expected))
      return failure('INVALID_INPUT');

    const ref = this.db.collection('hiringProcesses').doc(jobId);
    try {
      return success(
        await this.db.runTransaction(async (tx) => {
          const stored = (await tx.get(ref)).data();
          const version = Number(stored?.version) || 0;
          if (expected !== null && expected !== version)
            throw new Abort('VERSION_CONFLICT');
          const current = readHiringTeam(stored, activeIds);
          if (!canManageHiringTeam({ userId, role }, current.leadRecruiterId))
            throw new Abort('FORBIDDEN');
          const at = Timestamp.fromMillis(this.now());
          const previous = new Map(
            (Array.isArray(stored?.members) ? stored.members : []).map(
              (entry: Record<string, unknown>) => [
                `${entry.userId}:${entry.role}`,
                entry,
              ],
            ),
          );
          // Quem mantém a mesma função mantém a data e o autor da atribuição.
          const members = next.value.members.map((member) => {
            const kept = previous.get(`${member.userId}:${member.role}`) as
              Record<string, unknown> | undefined;
            return {
              ...member,
              assignedBy: kept?.assignedBy ?? userId,
              assignedAt: kept?.assignedAt ?? at,
            };
          });
          tx.set(ref, {
            organizationId,
            jobId,
            status: typeof stored?.status === 'string' ? stored.status : 'OPEN',
            openedAt: stored?.openedAt ?? at,
            leadRecruiterId: next.value.leadRecruiterId,
            hiringManagerId: next.value.hiringManagerId,
            members,
            memberIds: next.value.memberIds,
            version: version + 1,
            createdAt: stored?.createdAt ?? at,
            updatedAt: at,
            updatedBy: userId,
          });
          const before = new Set(current.memberIds);
          const after = new Set(next.value.memberIds);
          // H4/R71: só ids e funções, nunca nomes ou emails.
          tx.create(this.db.collection('auditLogs').doc(), {
            actorId: userId,
            actorType: 'EMPLOYER',
            action: 'hiring_team_updated',
            resourceType: 'HiringProcess',
            resourceId: jobId,
            organizationId,
            metadata: {
              added: [...after].filter((id) => !before.has(id)),
              removed: [...before].filter((id) => !after.has(id)),
              leadRecruiterChanged:
                current.leadRecruiterId !== next.value.leadRecruiterId,
              hiringManagerChanged:
                current.hiringManagerId !== next.value.hiringManagerId,
              version: version + 1,
            },
            at,
          });
          // R94/R95: aviso in-app só a quem entra agora, nunca a si próprio.
          for (const memberId of after)
            if (!before.has(memberId) && memberId !== userId)
              tx.create(this.db.collection('outboxEvents').doc(), {
                type: 'hiring_team_assigned',
                schemaVersion: 1,
                payload: { jobId, userId: memberId },
                status: 'PENDING',
                attempts: 0,
                createdAtMs: this.now(),
                nextAttemptAtMs: this.now(),
              });
          return { version: version + 1, memberIds: next.value.memberIds };
        }),
      );
    } catch (error) {
      if (error instanceof Abort) return failure(error.code);
      throw error;
    }
  }
}
