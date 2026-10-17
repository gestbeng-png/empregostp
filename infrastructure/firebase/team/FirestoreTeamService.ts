import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { FeatureFlagReader } from '@/application/marketplace/ports';
import { canUseFeature } from '@/domain/entitlements/canUseFeature';
import type { FeatureContext } from '@/domain/feature-flags/flags';
import {
  canAssignRole,
  canManageMember,
  INVITABLE_ROLES,
  INVITATION_TTL_MS,
  normalizeEmail,
  seatsAvailable,
} from '@/domain/memberships/teamRules';
import type { MemberRole } from '@/domain/memberships/teamRules';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { membershipId, validDocumentId } from '../marketplace/identifiers';

class Abort extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const ROLES = new Set<string>(['OWNER', 'ADMIN', 'RECRUITER', 'REVIEWER']);

/**
 * E12/D6 — equipa da organização. Toda a autorização vem das memberships
 * (ou, até ao backfill, da conta de empresa legada que é OWNER da organização
 * com o seu uid). O token do convite é um HMAC do id (o servidor consegue
 * refazê-lo para o email; só o hash fica guardado). Auditado (H4).
 */
export class FirestoreTeamService {
  constructor(
    private readonly db: Firestore,
    private readonly flags: FeatureFlagReader,
    private readonly context: FeatureContext,
    private readonly secret: string | undefined,
    private readonly now: () => number = Date.now,
  ) {}

  private at() {
    return Timestamp.fromMillis(this.now());
  }

  private token(invitationId: string): string {
    return createHmac('sha256', String(this.secret))
      .update(`team-invite:${invitationId}`)
      .digest('base64url');
  }

  private unexpired(invitation: Record<string, unknown>): boolean {
    const expiresAt = invitation.expiresAt as
      { toMillis?: () => number } | undefined;
    return (
      invitation.v2Status === 'PENDING' &&
      typeof expiresAt?.toMillis === 'function' &&
      expiresAt.toMillis() > this.now()
    );
  }

  private async assignments(
    organizationId: string,
    input: unknown,
  ): Promise<string[] | null> {
    if (input === undefined) return [];
    if (
      !Array.isArray(input) ||
      input.length > 100 ||
      input.some((id) => !validDocumentId(id))
    )
      return null;
    const ids = [...new Set(input as string[])];
    const jobs = await Promise.all(
      ids.map((id) => this.db.collection('jobs').doc(id).get()),
    );
    return jobs.every((job) => {
      const data = job.data();
      return data && (data.organizationId ?? data.companyId) === organizationId;
    })
      ? ids
      : null;
  }

  /** Only an organization manager can recover a still-valid invitation link. */
  async invitationLink(
    userId: string,
    invitationId: string,
  ): Promise<Result<{ acceptPath: string; expiresAt: string }>> {
    if (!this.secret || !validDocumentId(invitationId))
      return failure('NOT_FOUND');
    const invitation = (
      await this.db
        .collection('organizationInvitations')
        .doc(invitationId)
        .get()
    ).data();
    if (!invitation) return failure('NOT_FOUND');
    const role = await this.roleOf(userId, String(invitation.organizationId));
    if (role !== 'OWNER' && role !== 'ADMIN') return failure('FORBIDDEN');
    if (!this.unexpired(invitation))
      return failure(
        'INVALID_TRANSITION',
        'Este convite já não está disponível. Crie um novo convite.',
      );
    return success({
      acceptPath: `/equipa/convite?i=${invitationId}&t=${this.token(invitationId)}`,
      expiresAt: new Date(
        (invitation.expiresAt as { toMillis(): number }).toMillis(),
      ).toISOString(),
    });
  }

  /** Read-only preview: the token stays in the request body, never in API URLs. */
  async previewInvitation(
    user: { uid: string; email: string | null; emailVerified: boolean },
    invitationId: string,
    token: unknown,
  ): Promise<
    Result<{
      organizationId: string;
      organizationName: string;
      role: MemberRole;
      status: string;
      expiresAt: string;
      emailMatches: boolean;
      emailVerified: boolean;
    }>
  > {
    if (
      !this.secret ||
      !validDocumentId(invitationId) ||
      typeof token !== 'string'
    )
      return failure('NOT_FOUND');
    const expected = Buffer.from(this.token(invitationId));
    const actual = Buffer.from(token);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return failure('NOT_FOUND');
    const invitation = (
      await this.db
        .collection('organizationInvitations')
        .doc(invitationId)
        .get()
    ).data();
    if (!invitation) return failure('NOT_FOUND');
    const organizationId = String(invitation.organizationId);
    const [organization, legacy] = await Promise.all([
      this.db.collection('organizations').doc(organizationId).get(),
      this.db.collection('users').doc(organizationId).get(),
    ]);
    const org = organization.data();
    const owner = legacy.data();
    return success({
      organizationId,
      organizationName: String(
        org?.name ||
          org?.legalName ||
          owner?.companyName ||
          owner?.name ||
          'Organização',
      ),
      role: invitation.role as MemberRole,
      status:
        invitation.v2Status === 'PENDING' && !this.unexpired(invitation)
          ? 'EXPIRED'
          : String(invitation.v2Status),
      expiresAt: new Date(
        (invitation.expiresAt as { toMillis(): number }).toMillis(),
      ).toISOString(),
      emailMatches: normalizeEmail(user.email) === invitation.email,
      emailVerified: user.emailVerified,
    });
  }

  private async run<T>(
    fn: (tx: Transaction) => Promise<T>,
  ): Promise<Result<T>> {
    try {
      return success(await this.db.runTransaction(fn));
    } catch (error) {
      if (error instanceof Abort) return failure(error.code, error.message);
      throw error;
    }
  }

  private audit(
    tx: Transaction,
    actorId: string,
    action: string,
    organizationId: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    tx.create(this.db.collection('auditLogs').doc(), {
      actorId,
      actorType: 'EMPLOYER',
      action,
      resourceType: 'OrganizationMembership',
      resourceId,
      organizationId,
      metadata,
      at: this.at(),
    });
  }

  /** Papel ativo do utilizador na organização (membership ou OWNER legado). */
  async roleOf(
    userId: string,
    organizationId: string,
  ): Promise<MemberRole | null> {
    if (!validDocumentId(userId) || !validDocumentId(organizationId))
      return null;
    const membership = (
      await this.db
        .collection('organizationMemberships')
        .doc(membershipId(userId, organizationId))
        .get()
    ).data();
    if (membership)
      return membership.status === 'ACTIVE' &&
        ROLES.has(String(membership.role))
        ? (membership.role as MemberRole)
        : null;
    if (userId !== organizationId) return null;
    const user = (await this.db.collection('users').doc(userId).get()).data();
    const ownerMoved = (
      await this.db.collection('organizations').doc(organizationId).get()
    ).data()?.ownerUserId;
    return user?.userType === 'empresa' &&
      (!ownerMoved || ownerMoved === userId)
      ? 'OWNER'
      : null;
  }

  private async members(organizationId: string) {
    const page = await this.db
      .collection('organizationMemberships')
      .where('organizationId', '==', organizationId)
      .get();
    return page.docs
      .map((doc) => doc.data())
      .filter((m) => m.status === 'ACTIVE');
  }

  async invite(
    userId: string,
    organizationId: string,
    input: {
      email?: unknown;
      role?: unknown;
      assignedJobIds?: unknown;
      idempotencyKey?: unknown;
    },
  ): Promise<
    Result<{
      invitationId: string;
      acceptPath: string;
      expiresAt: string;
      email: string;
    }>
  > {
    if (!this.secret)
      return failure(
        'FEATURE_DISABLED',
        'Convites indisponíveis: configuração em falta.',
      );
    const email = normalizeEmail(input.email);
    const role = input.role as MemberRole;
    if (!email || !INVITABLE_ROLES.includes(role))
      return failure('INVALID_INPUT', 'Indique um email válido e o papel.');
    if (
      !(await this.flags.enabled('V2_EMPLOYER_ATS', {
        ...this.context,
        organizationId,
        userId,
      }))
    )
      return failure('FEATURE_DISABLED');
    const actorRole = await this.roleOf(userId, organizationId);
    if (!actorRole || !canAssignRole(actorRole, role))
      return failure('FORBIDDEN');
    const assignedJobIds =
      role === 'RECRUITER'
        ? await this.assignments(organizationId, input.assignedJobIds)
        : [];
    if (!assignedJobIds)
      return failure(
        'INVALID_INPUT',
        'Escolha apenas vagas desta organização.',
      );
    if (
      input.idempotencyKey !== undefined &&
      (typeof input.idempotencyKey !== 'string' ||
        !/^[a-zA-Z0-9_-]{16,128}$/.test(input.idempotencyKey))
    )
      return failure('INVALID_INPUT', 'Pedido inválido. Tente novamente.');
    const invitationCollection = this.db.collection('organizationInvitations');
    const ref =
      typeof input.idempotencyKey === 'string'
        ? invitationCollection.doc(
            createHash('sha256')
              .update(`${organizationId}:${userId}:${input.idempotencyKey}`)
              .digest('hex'),
          )
        : invitationCollection.doc();
    const previous = (await ref.get()).data();
    if (previous) {
      if (
        previous.email !== email ||
        previous.role !== role ||
        JSON.stringify(previous.assignedJobIds || []) !==
          JSON.stringify(assignedJobIds)
      )
        return failure(
          'IDEMPOTENCY_CONFLICT',
          'Este pedido já foi usado para outro convite.',
        );
      if (!this.unexpired(previous))
        return failure(
          'INVALID_TRANSITION',
          'Este convite já não está disponível.',
        );
      return success({
        invitationId: ref.id,
        acceptPath: `/equipa/convite?i=${ref.id}&t=${this.token(ref.id)}`,
        expiresAt: new Date(
          (previous.expiresAt as { toMillis(): number }).toMillis(),
        ).toISOString(),
        email,
      });
    }
    const [members, pending] = await Promise.all([
      this.members(organizationId),
      this.db
        .collection('organizationInvitations')
        .where('organizationId', '==', organizationId)
        .where('v2Status', '==', 'PENDING')
        .get(),
    ]);
    const activeInvitations = pending.docs.filter((doc) =>
      this.unexpired(doc.data()),
    );
    if (activeInvitations.some((doc) => doc.data().email === email))
      return failure(
        'IDEMPOTENCY_CONFLICT',
        'Já existe um convite pendente para este email.',
      );
    const legacyOwnerCounts = members.every((m) => m.role !== 'OWNER') ? 1 : 0;
    const seats = canUseFeature(
      { type: 'ORGANIZATION', id: organizationId },
      'SEATS',
      [],
      { now: this.now(), v2Enabled: true },
    );
    if (
      !seatsAvailable({
        activeMembers: members.length + legacyOwnerCounts,
        pendingInvitations: activeInvitations.length,
        limit: seats.limit,
      })
    )
      return failure(
        'FORBIDDEN',
        `O seu plano permite ${seats.limit} membros na equipa.`,
      );
    const token = this.token(ref.id);
    const expiresAtMs = this.now() + INVITATION_TTL_MS;
    return this.run(async (tx) => {
      const [freshInvitation, memberPage, invitationPage] = await Promise.all([
        tx.get(ref),
        tx.get(
          this.db
            .collection('organizationMemberships')
            .where('organizationId', '==', organizationId),
        ),
        tx.get(
          this.db
            .collection('organizationInvitations')
            .where('organizationId', '==', organizationId),
        ),
      ]);
      if (freshInvitation.exists) {
        const data = freshInvitation.data();
        if (!data) throw new Abort('NOT_FOUND');
        if (
          data.email !== email ||
          data.role !== role ||
          JSON.stringify(data.assignedJobIds || []) !==
            JSON.stringify(assignedJobIds)
        )
          throw new Abort('IDEMPOTENCY_CONFLICT');
        if (!this.unexpired(data)) throw new Abort('INVALID_TRANSITION');
        return {
          invitationId: ref.id,
          acceptPath: `/equipa/convite?i=${ref.id}&t=${token}`,
          expiresAt: new Date(
            (data.expiresAt as { toMillis(): number }).toMillis(),
          ).toISOString(),
          email,
        };
      }
      const currentMembers = memberPage.docs
        .map((doc) => doc.data())
        .filter((member) => member.status === 'ACTIVE');
      const currentInvitations = invitationPage.docs
        .map((doc) => doc.data())
        .filter((invitation) => this.unexpired(invitation));
      if (currentInvitations.some((invitation) => invitation.email === email))
        throw new Abort(
          'IDEMPOTENCY_CONFLICT',
          'Já existe um convite pendente para este email.',
        );
      if (
        !seatsAvailable({
          activeMembers:
            currentMembers.length +
            (currentMembers.some((member) => member.role === 'OWNER') ? 0 : 1),
          pendingInvitations: currentInvitations.length,
          limit: seats.limit,
        })
      )
        throw new Abort(
          'FORBIDDEN',
          'Todos os lugares da equipa estão ocupados.',
        );
      tx.create(ref, {
        organizationId,
        email,
        role,
        invitedBy: userId,
        assignedJobIds,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        v2Status: 'PENDING',
        version: 1,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        createdAt: this.at(),
      });
      tx.create(this.db.collection('outboxEvents').doc(), {
        type: 'entity_status_changed',
        schemaVersion: 1,
        payload: { entityId: ref.id, entityKind: 'TeamInvitation', version: 1 },
        status: 'PENDING',
        attempts: 0,
        createdAtMs: this.now(),
        nextAttemptAtMs: this.now(),
      });
      this.audit(tx, userId, 'team_invitation_sent', organizationId, ref.id, {
        role,
      });
      return {
        invitationId: ref.id,
        acceptPath: `/equipa/convite?i=${ref.id}&t=${token}`,
        expiresAt: new Date(expiresAtMs).toISOString(),
        email,
      };
    });
  }

  /** Só aceita quem tem o email verificado igual ao convidado (E12). */
  async accept(
    user: { uid: string; email: string | null; emailVerified: boolean },
    invitationId: string,
    token: unknown,
  ): Promise<Result<{ organizationId: string; role: MemberRole }>> {
    if (
      !this.secret ||
      !validDocumentId(invitationId) ||
      typeof token !== 'string'
    )
      return failure('NOT_FOUND');
    const expected = Buffer.from(this.token(invitationId));
    const given = Buffer.from(token);
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      return failure('NOT_FOUND');
    const ref = this.db.collection('organizationInvitations').doc(invitationId);
    return this.run(async (tx) => {
      const invitation = (await tx.get(ref)).data();
      if (!invitation) throw new Abort('NOT_FOUND');
      if (
        invitation.v2Status === 'ACCEPTED' &&
        invitation.acceptedBy === user.uid &&
        user.emailVerified &&
        normalizeEmail(user.email) === invitation.email
      ) {
        const member = (
          await tx.get(
            this.db
              .collection('organizationMemberships')
              .doc(membershipId(user.uid, String(invitation.organizationId))),
          )
        ).data();
        if (member?.status !== 'ACTIVE' || !ROLES.has(String(member.role)))
          throw new Abort('FORBIDDEN');
        return {
          organizationId: String(invitation.organizationId),
          role: member.role as MemberRole,
        };
      }
      if (invitation.v2Status !== 'PENDING')
        throw new Abort('INVALID_TRANSITION', 'Este convite já não é válido.');
      if (
        (invitation.expiresAt as { toMillis: () => number }).toMillis() <=
        this.now()
      ) {
        tx.update(ref, {
          v2Status: 'EXPIRED',
          version: (Number(invitation.version) || 1) + 1,
        });
        return { expired: true } as never;
      }
      if (
        !user.emailVerified ||
        normalizeEmail(user.email) !== invitation.email
      )
        throw new Abort(
          'FORBIDDEN',
          'Entre com a conta do email convidado (verificado).',
        );
      const organizationId = String(invitation.organizationId);
      const memberRef = this.db
        .collection('organizationMemberships')
        .doc(membershipId(user.uid, organizationId));
      const existing = (await tx.get(memberRef)).data();
      if (existing?.status === 'ACTIVE')
        throw new Abort(
          'IDEMPOTENCY_CONFLICT',
          'Já é membro desta organização.',
        );
      tx.set(memberRef, {
        userId: user.uid,
        organizationId,
        role: invitation.role,
        status: 'ACTIVE',
        invitedBy: invitation.invitedBy,
        assignedJobIds: Array.isArray(invitation.assignedJobIds)
          ? invitation.assignedJobIds
          : [],
        joinedAtMs: this.now(),
      });
      tx.update(ref, {
        v2Status: 'ACCEPTED',
        version: (Number(invitation.version) || 1) + 1,
        acceptedBy: user.uid,
        acceptedAt: this.at(),
      });
      this.audit(
        tx,
        user.uid,
        'team_invitation_accepted',
        organizationId,
        invitationId,
        { role: invitation.role },
      );
      return { organizationId, role: invitation.role as MemberRole };
    }).then((result) =>
      result.ok && 'expired' in (result.value as object)
        ? failure('INVALID_TRANSITION', 'Este convite expirou.')
        : result,
    );
  }

  async revoke(
    userId: string,
    invitationId: string,
  ): Promise<Result<{ status: 'REVOKED' }>> {
    if (!validDocumentId(invitationId)) return failure('NOT_FOUND');
    const ref = this.db.collection('organizationInvitations').doc(invitationId);
    const invitation = (await ref.get()).data();
    if (!invitation) return failure('NOT_FOUND');
    const role = await this.roleOf(userId, String(invitation.organizationId));
    if (role !== 'OWNER' && role !== 'ADMIN') return failure('FORBIDDEN');
    return this.run(async (tx) => {
      const fresh = (await tx.get(ref)).data();
      if (fresh?.v2Status !== 'PENDING') throw new Abort('INVALID_TRANSITION');
      tx.update(ref, {
        v2Status: 'REVOKED',
        version: (Number(fresh.version) || 1) + 1,
        revokedBy: userId,
        revokedAt: this.at(),
      });
      this.audit(
        tx,
        userId,
        'team_invitation_revoked',
        String(fresh.organizationId),
        invitationId,
        {},
      );
      return { status: 'REVOKED' as const };
    });
  }

  async changeMember(
    userId: string,
    organizationId: string,
    memberUserId: string,
    change: { role?: unknown; remove?: boolean; assignedJobIds?: unknown },
  ): Promise<Result<{ updated: true }>> {
    const actorRole = await this.roleOf(userId, organizationId);
    const memberRole = await this.roleOf(memberUserId, organizationId);
    if (!actorRole || !memberRole) return failure('NOT_FOUND');
    if (
      !canManageMember(
        { userId, role: actorRole },
        { userId: memberUserId, role: memberRole },
      )
    )
      return failure('FORBIDDEN');
    const newRole = change.role as MemberRole | undefined;
    if (!change.remove && (!newRole || !canAssignRole(actorRole, newRole)))
      return failure('FORBIDDEN');
    const assignedJobIds =
      !change.remove &&
      newRole === 'RECRUITER' &&
      change.assignedJobIds !== undefined
        ? await this.assignments(organizationId, change.assignedJobIds)
        : undefined;
    if (assignedJobIds === null)
      return failure(
        'INVALID_INPUT',
        'Escolha apenas vagas desta organização.',
      );
    const ref = this.db
      .collection('organizationMemberships')
      .doc(membershipId(memberUserId, organizationId));
    return this.run(async (tx) => {
      if (!(await tx.get(ref)).exists) throw new Abort('NOT_FOUND');
      tx.update(
        ref,
        change.remove
          ? { status: 'REMOVED', removedBy: userId, removedAtMs: this.now() }
          : {
              role: newRole,
              ...(assignedJobIds
                ? { assignedJobIds, canViewAllJobs: false }
                : {}),
              ...(newRole !== 'RECRUITER'
                ? { assignedJobIds: [], canViewAllJobs: false }
                : {}),
            },
      );
      this.audit(
        tx,
        userId,
        change.remove ? 'team_member_removed' : 'team_member_role_changed',
        organizationId,
        memberUserId,
        change.remove ? {} : { role: newRole },
      );
      return { updated: true as const };
    });
  }

  /** Transferência: o OWNER escolhe um ADMIN ativo; só fica feita quando este aceita. */
  async requestOwnershipTransfer(
    ownerId: string,
    organizationId: string,
    targetUserId: string,
  ): Promise<Result<{ status: 'PENDING' }>> {
    if ((await this.roleOf(ownerId, organizationId)) !== 'OWNER')
      return failure('FORBIDDEN');
    if ((await this.roleOf(targetUserId, organizationId)) !== 'ADMIN')
      return failure(
        'INVALID_INPUT',
        'A propriedade só pode passar para um administrador ativo.',
      );
    await this.db
      .collection('ownershipTransfers')
      .doc(organizationId)
      .set({
        organizationId,
        fromUserId: ownerId,
        toUserId: targetUserId,
        status: 'PENDING',
        expiresAtMs: this.now() + INVITATION_TTL_MS,
        createdAt: this.at(),
      });
    return success({ status: 'PENDING' });
  }

  async acceptOwnershipTransfer(
    targetUserId: string,
    organizationId: string,
  ): Promise<Result<{ role: 'OWNER' }>> {
    if (!validDocumentId(organizationId)) return failure('NOT_FOUND');
    const transferRef = this.db
      .collection('ownershipTransfers')
      .doc(organizationId);
    const transfer = (await transferRef.get()).data();
    if (
      !transfer ||
      transfer.toUserId !== targetUserId ||
      transfer.status !== 'PENDING' ||
      Number(transfer.expiresAtMs) <= this.now()
    )
      return failure('NOT_FOUND');
    if (
      (await this.roleOf(String(transfer.fromUserId), organizationId)) !==
        'OWNER' ||
      (await this.roleOf(targetUserId, organizationId)) !== 'ADMIN'
    )
      return failure('INVALID_TRANSITION');
    const fromRef = this.db
      .collection('organizationMemberships')
      .doc(membershipId(String(transfer.fromUserId), organizationId));
    const toRef = this.db
      .collection('organizationMemberships')
      .doc(membershipId(targetUserId, organizationId));
    return this.run(async (tx) => {
      const [fromDoc, current] = await Promise.all([
        tx.get(fromRef),
        tx.get(transferRef),
      ]);
      if (current.data()?.status !== 'PENDING')
        throw new Abort('INVALID_TRANSITION');
      // Exatamente 1 OWNER: troca na mesma transação; o antigo passa a ADMIN.
      if (fromDoc.exists) tx.update(fromRef, { role: 'ADMIN' });
      else
        tx.set(fromRef, {
          userId: transfer.fromUserId,
          organizationId,
          role: 'ADMIN',
          status: 'ACTIVE',
          joinedAtMs: this.now(),
        });
      tx.update(toRef, { role: 'OWNER' });
      tx.set(
        this.db.collection('organizations').doc(organizationId),
        { ownerUserId: targetUserId, updatedAt: this.at() },
        { merge: true },
      );
      tx.update(transferRef, { status: 'ACCEPTED', acceptedAt: this.at() });
      this.audit(
        tx,
        targetUserId,
        'ownership_transferred',
        organizationId,
        organizationId,
        { from: transfer.fromUserId },
      );
      return { role: 'OWNER' as const };
    });
  }

  /** D6 — seletor de organização: só as organizações onde o utilizador é membro ativo. */
  async myOrganizations(
    userId: string,
  ): Promise<{ organizationId: string; role: MemberRole }[]> {
    const page = await this.db
      .collection('organizationMemberships')
      .where('userId', '==', userId)
      .get();
    const list = page.docs
      .map((doc) => doc.data())
      .filter((m) => m.status === 'ACTIVE' && ROLES.has(String(m.role)))
      .map((m) => ({
        organizationId: String(m.organizationId),
        role: m.role as MemberRole,
      }));
    const legacy = await this.roleOf(userId, userId);
    if (legacy && !list.some((item) => item.organizationId === userId))
      list.unshift({ organizationId: userId, role: legacy });
    return list;
  }
}
