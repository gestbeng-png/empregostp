import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type {
  LifecycleRecord,
  LifecycleStore,
  ResolvedIdentity,
  SystemLifecycleStore,
  SystemTransitionCommand,
  TransitionCommand,
  TransitionPolicy,
  TransitionReceipt,
} from '@/application/marketplace/ports';
import {
  candidateStatusLabel,
  CLOSED_REASONS,
} from '@/domain/applications/candidateView';
import type { ApplicationStatus } from '@/domain/applications/states';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';
import { assertTransition, assertVersion } from '@/domain/lifecycle/states';
import type { EntityKind } from '@/domain/lifecycle/states';
import { failure, success } from '@/domain/shared/Result';
import type { Result } from '@/domain/shared/Result';
import { isUserAccountActive } from '@/lib/userStatus';

import { digest, membershipId, validDocumentId } from './identifiers';

export const ENTITY_COLLECTIONS: Readonly<Record<EntityKind, string>> =
  Object.freeze({
    Job: 'jobs',
    Application: 'applications',
    Interview: 'interviews',
    Offer: 'offers',
    VerificationRequest: 'verificationRequests',
    Report: 'reports',
    ModerationCase: 'moderationCases',
    Payment: 'payments',
    Subscription: 'subscriptions',
    TeamInvitation: 'organizationInvitations',
    Hire: 'hires',
    TalentInvite: 'talentInvites',
  });
const IDEMPOTENCY_TTL_MS = 86_400_000;
const membershipRoles = {
  OWNER: 'OWNER',
  ADMIN: 'ORG_ADMIN',
  RECRUITER: 'RECRUITER',
  REVIEWER: 'ORG_REVIEWER',
} as const;

function optionalString(
  data: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  return typeof data[key] === 'string' ? data[key] : undefined;
}

/** All identity lookups are inside the same transaction as the write. An
 * organization id in a command never substitutes for an active membership. */
export async function resolveIdentity(
  db: Firestore,
  tx: Transaction,
  userId: string,
  organizationId?: string,
): Promise<ResolvedIdentity | undefined> {
  const snapshot = await tx.get(db.collection('users').doc(userId));
  const user: Record<string, unknown> | undefined = snapshot.data();
  if (!user || !isUserAccountActive(user)) return undefined;
  const base = { userId, active: true };
  if (user.userType === 'admin')
    return { permission: { ...base, role: 'ADMIN' }, transition: 'ADMIN' };
  if (
    user.platformRole === 'MODERATOR' ||
    user.platformRole === 'REVIEWER' ||
    user.platformRole === 'SUPPORT'
  )
    return {
      permission: { ...base, role: user.platformRole },
      transition: user.platformRole,
    };
  if (organizationId && validDocumentId(organizationId)) {
    const membership = (
      await tx.get(
        db
          .collection('organizationMemberships')
          .doc(membershipId(userId, organizationId)),
      )
    ).data();
    if (
      membership?.status === 'ACTIVE' &&
      membership.userId === userId &&
      membership.organizationId === organizationId &&
      typeof membership.role === 'string' &&
      Object.hasOwn(membershipRoles, membership.role)
    ) {
      const role =
        membershipRoles[membership.role as keyof typeof membershipRoles];
      const canViewAllJobs = membership.canViewAllJobs === true;
      const assignedJobIds = Array.isArray(membership.assignedJobIds)
        ? membership.assignedJobIds.filter(
            (id: unknown): id is string => typeof id === 'string',
          )
        : [];
      // R7/R13: um recrutador limitado às vagas atribuídas vê também as vagas
      // em cuja equipa está. Lido a cada pedido: sair da equipa tira o acesso
      // de imediato (R107), sem esperar por tokens.
      if (role === 'RECRUITER' && !canViewAllJobs) {
        const teams = await tx.get(
          db
            .collection('hiringProcesses')
            .where('organizationId', '==', organizationId)
            .where('memberIds', 'array-contains', userId)
            .limit(100),
        );
        for (const doc of teams.docs)
          if (!assignedJobIds.includes(doc.id)) assignedJobIds.push(doc.id);
      }
      return {
        permission: {
          ...base,
          role,
          organizationId,
          membershipActive: true,
          assignedJobIds,
          recruiterCanViewAllJobs: canViewAllJobs,
        },
        transition: role,
      };
    }
  }
  // D6/D7: até ao backfill de memberships, a conta de empresa legada é a
  // OWNER da organização com o seu próprio uid (1 utilizador = 1 empresa).
  // Lido do campo antigo só como recurso; nunca concede outra organização.
  if (
    user.userType === 'empresa' &&
    organizationId &&
    organizationId === userId &&
    !(
      await tx.get(
        db
          .collection('organizationMemberships')
          .doc(membershipId(userId, organizationId)),
      )
    ).exists
  )
    return {
      permission: {
        ...base,
        role: 'OWNER',
        organizationId,
        membershipActive: true,
        assignedJobIds: [],
        recruiterCanViewAllJobs: true,
      },
      transition: 'OWNER',
    };
  if (user.userType === 'candidato')
    return {
      permission: { ...base, role: 'CANDIDATE' },
      transition: 'CANDIDATE',
    };
  return undefined;
}

const MAX_NOTE = 1000;

const SYSTEM_JOB = /^[a-z][a-zA-Z0-9]{2,40}$/;

export class FirestoreLifecycleStore
  implements LifecycleStore, SystemLifecycleStore
{
  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  async transition(
    command: TransitionCommand,
    policy: TransitionPolicy,
  ): Promise<Result<TransitionReceipt>> {
    return this.execute(command, policy);
  }

  /** LIF-01: SYSTEM transitions (cron expiry, first view). The identity is
   * fixed here and never derived from a user id, so no user can pose as the
   * system. `can()` denies everything for it: the policy must rely on facts. */
  async transitionAsSystem(
    { systemJob, ...command }: SystemTransitionCommand,
    policy: TransitionPolicy,
  ): Promise<Result<TransitionReceipt>> {
    if (typeof systemJob !== 'string' || !SYSTEM_JOB.test(systemJob))
      return failure('INVALID_INPUT');
    return this.execute(
      { ...command, actorUserId: `system:${systemJob}` },
      policy,
      true,
    );
  }

  private async execute(
    command: TransitionCommand,
    policy: TransitionPolicy,
    system = false,
  ): Promise<Result<TransitionReceipt>> {
    const collection = ENTITY_COLLECTIONS[command.kind];
    if (
      !collection ||
      !validDocumentId(command.entityId) ||
      !validDocumentId(command.actorUserId) ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(command.idempotencyKey) ||
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 0 ||
      typeof command.to !== 'string' ||
      (command.reason !== undefined &&
        (typeof command.reason !== 'string' || command.reason.length > 2000)) ||
      (command.closedReason !== undefined &&
        (command.kind !== 'Application' ||
          !(CLOSED_REASONS as readonly string[]).includes(
            command.closedReason,
          ))) ||
      (command.candidateVisibleNote !== undefined &&
        (command.kind !== 'Application' ||
          typeof command.candidateVisibleNote !== 'string' ||
          command.candidateVisibleNote.length > MAX_NOTE))
    )
      return failure('INVALID_INPUT');
    const entityRef = this.db.collection(collection).doc(command.entityId);
    const scope = `${command.kind}:${command.entityId}`;
    const keyHash = digest([
      command.actorUserId,
      scope,
      command.idempotencyKey,
    ]);
    const requestHash = digest([
      scope,
      command.to,
      command.expectedVersion,
      command.reason ?? null,
    ]);
    const keyRef = this.db.collection('idempotencyKeys').doc(keyHash);
    // Allocate once, not on each Firestore transaction retry.
    const eventRef = this.db.collection('outboxEvents').doc();
    const auditRef = this.db.collection('auditLogs').doc();
    const historyRef = this.db.collection(`${collection}StatusHistory`).doc();

    return this.db.runTransaction(
      async (tx): Promise<Result<TransitionReceipt>> => {
        const [entity, prior] = await Promise.all([
          tx.get(entityRef),
          tx.get(keyRef),
        ]);
        const data: Record<string, unknown> | undefined = entity.data();
        if (!data) return failure('NOT_FOUND');
        // Legacy statuses remain untouched. Phase 2 must expand/backfill v2Status
        // before enabling this service; never infer a lifecycle from booleans.
        if (
          typeof data.v2Status !== 'string' ||
          !Number.isSafeInteger(data.version)
        )
          return failure('VERSION_CONFLICT');
        const record: LifecycleRecord = {
          id: entity.id,
          kind: command.kind,
          v2Status: data.v2Status,
          version: data.version as number,
          organizationId: optionalString(data, 'organizationId'),
          ownerUserId: optionalString(data, 'ownerUserId'),
          candidateUserId: optionalString(data, 'candidateUserId'),
          jobId: optionalString(data, 'jobId'),
          facts: data,
        };
        const identity: ResolvedIdentity | undefined = system
          ? {
              permission: {
                userId: command.actorUserId,
                role: 'NONE',
                active: true,
              },
              transition: 'SYSTEM',
            }
          : await resolveIdentity(
              this.db,
              tx,
              command.actorUserId,
              record.organizationId,
            );
        if (!identity) return failure('FORBIDDEN');
        if (
          identity.permission.role === 'CANDIDATE' &&
          record.candidateUserId !== command.actorUserId &&
          record.ownerUserId !== command.actorUserId
        )
          return failure('FORBIDDEN');
        if (
          ['OWNER', 'ORG_ADMIN', 'RECRUITER', 'ORG_REVIEWER'].includes(
            identity.permission.role,
          ) &&
          (!identity.permission.membershipActive ||
            identity.permission.organizationId !== record.organizationId)
        )
          return failure('FORBIDDEN');
        // The policy is trusted, pure and side-effect-free: transactions retry it.
        // It must check can()/resource scope; reason is for audited break-glass.
        identity.permission.reason = command.reason;
        const context = await policy(record, identity);
        if (!context.ok) return context;
        const saved = prior.data();
        const now = this.now();
        if (
          saved &&
          typeof saved.expiresAtMs === 'number' &&
          saved.expiresAtMs > now
        ) {
          if (saved.requestHash !== requestHash)
            return failure('IDEMPOTENCY_CONFLICT');
          const receipt = saved.response;
          if (
            !receipt ||
            receipt.entityId !== command.entityId ||
            typeof receipt.status !== 'string' ||
            !Number.isSafeInteger(receipt.version) ||
            typeof receipt.eventId !== 'string'
          )
            return failure('IDEMPOTENCY_CONFLICT');
          return success(receipt as TransitionReceipt);
        }
        const versionCheck = assertVersion(
          command.expectedVersion,
          record.version,
        );
        if (!versionCheck.ok) return versionCheck;
        const transitionCheck = assertTransition(
          command.kind,
          record.v2Status,
          command.to,
          identity.transition,
          {
            ...context.value,
            reason: command.reason,
            // E4: REJECTED exige motivo de fecho da lista fechada.
            guards: {
              ...context.value.guards,
              ...(command.kind === 'Application'
                ? { hasClosedReason: Boolean(command.closedReason) }
                : {}),
            },
          },
        );
        if (!transitionCheck.ok) return transitionCheck;
        // MIG-01/D7: o estado legado muda na mesma transação, ou a UI atual
        // mostraria um estado desatualizado.
        const legacy = legacyStatusUpdate(command.kind, command.to);
        if (!legacy.ok) return legacy;
        if (record.version >= Number.MAX_SAFE_INTEGER)
          return failure('VERSION_CONFLICT');
        const version = record.version + 1;
        const receipt: TransitionReceipt = {
          entityId: entity.id,
          status: command.to,
          version,
          eventId: eventRef.id,
        };
        const at = Timestamp.fromMillis(now);
        const note = command.candidateVisibleNote?.trim() || null;
        tx.update(entityRef, {
          ...legacy.value,
          v2Status: command.to,
          version,
          updatedAt: at,
          updatedBy: command.actorUserId,
          ...(command.kind === 'Application'
            ? {
                lastStatusChangeAt: at,
                ...(command.closedReason
                  ? { closedReason: command.closedReason }
                  : {}),
                ...(record.v2Status === 'SUBMITTED' &&
                !record.facts.firstViewedAt
                  ? { firstViewedAt: at }
                  : {}),
                // Painéis atuais leem `timeline`: entrada com o rótulo E4.
                timeline: [
                  ...(Array.isArray(record.facts.timeline)
                    ? (record.facts.timeline as unknown[])
                    : []),
                  {
                    title: candidateStatusLabel(
                      command.to as ApplicationStatus,
                      command.closedReason ?? null,
                    ),
                    description: note ?? '',
                    date: new Date(now).toISOString(),
                    byType:
                      identity.transition === 'SYSTEM' ? 'sistema' : 'empresa',
                    version,
                  },
                ].slice(-40),
              }
            : {}),
        });
        tx.create(historyRef, {
          entityId: entity.id,
          from: record.v2Status,
          to: command.to,
          actorId: command.actorUserId,
          actorType: identity.transition,
          reason: command.reason ?? null,
          ...(command.kind === 'Application'
            ? {
                closedReason: command.closedReason ?? null,
                candidateVisibleNote: note,
              }
            : {}),
          at,
          version,
        });
        tx.create(eventRef, {
          type: 'entity_status_changed',
          schemaVersion: 1,
          payload: { entityId: entity.id, entityKind: command.kind, version },
          status: 'PENDING',
          attempts: 0,
          createdAtMs: now,
          nextAttemptAtMs: now,
        });
        // create only: no repository operation updates or deletes audit entries.
        tx.create(auditRef, {
          actorId: command.actorUserId,
          actorType: identity.transition,
          action: 'entity_status_changed',
          resourceType: command.kind,
          resourceId: entity.id,
          ...(record.organizationId
            ? { organizationId: record.organizationId }
            : {}),
          metadata: { from: record.v2Status, to: command.to, version },
          at: Timestamp.fromMillis(now),
        });
        tx.set(keyRef, {
          keyHash,
          scope,
          actorId: command.actorUserId,
          requestHash,
          response: receipt,
          createdAt: Timestamp.fromMillis(now),
          expiresAtMs: now + IDEMPOTENCY_TTL_MS,
          expiresAt: Timestamp.fromMillis(now + IDEMPOTENCY_TTL_MS),
        });
        return success(receipt);
      },
    );
  }
}
