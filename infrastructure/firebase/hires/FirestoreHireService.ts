import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { FeatureFlagReader } from '@/application/marketplace/ports';
import { assertTransition as assertApplication } from '@/domain/applications/states';
import type { ApplicationStatus } from '@/domain/applications/states';
import type { FeatureContext } from '@/domain/feature-flags/flags';
import {
  CANDIDATE_ANSWERS,
  hireFollowUpStage,
  parseStartDate,
  positionsSummary,
} from '@/domain/hires/confirmation';
import type { CandidateConfirmation } from '@/domain/hires/confirmation';
import { assertTransition as assertHire } from '@/domain/hires/states';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';
import type { TransitionActor } from '@/domain/lifecycle/states';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { resolveIdentity } from '../marketplace/FirestoreLifecycleStore';
import { validDocumentId } from '../marketplace/identifiers';

type Plain = Record<string, unknown>;

class Abort extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value)
    return (value as { toDate: () => Date }).toDate();
  return null;
}

const PATHS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  SUBMITTED: ['UNDER_REVIEW', 'SHORTLISTED', 'HIRED'],
  UNDER_REVIEW: ['SHORTLISTED', 'HIRED'],
  SHORTLISTED: ['HIRED'],
  INTERVIEW: ['HIRED'],
  OFFER: ['HIRED'],
};

/**
 * E5/F3.8 — contratação. `hires/{applicationId}`: no máximo uma por
 * candidatura (o id é a própria idempotência). Tudo numa transação:
 * candidatura → HIRED (com passos intermédios), Hire ACTIVE, histórico,
 * outbox e, quando as posições ficam completas, a proposta de FILLED.
 */
export class FirestoreHireService {
  constructor(
    private readonly db: Firestore,
    private readonly flags: FeatureFlagReader,
    private readonly context: FeatureContext,
    private readonly now: () => number = Date.now,
  ) {}

  private at() {
    return Timestamp.fromMillis(this.now());
  }

  private event(tx: Transaction, type: string, payload: Plain) {
    tx.create(this.db.collection('outboxEvents').doc(), {
      type,
      schemaVersion: 1,
      payload,
      status: 'PENDING',
      attempts: 0,
      createdAtMs: this.now(),
      nextAttemptAtMs: this.now(),
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

  async markHired(
    userId: string,
    applicationId: string,
    input: { startDate?: unknown },
  ): Promise<
    Result<{
      hireId: string;
      replayed: boolean;
      positions: string;
      proposeFilled: boolean;
    }>
  > {
    if (!validDocumentId(applicationId)) return failure('INVALID_INPUT');
    const startDate = parseStartDate(input.startDate, new Date(this.now()));
    if (startDate === 'INVALID')
      return failure('INVALID_INPUT', 'Data de início inválida.');
    const appRef = this.db.collection('applications').doc(applicationId);
    const app = (await appRef.get()).data();
    if (
      !app ||
      typeof app.v2Status !== 'string' ||
      typeof app.organizationId !== 'string'
    )
      return failure('NOT_FOUND');
    const organizationId = app.organizationId;
    if (
      !(await this.flags.enabled('V2_EMPLOYER_ATS', {
        ...this.context,
        organizationId,
        userId,
      }))
    )
      return failure('FEATURE_DISABLED');
    const identity = await resolveIdentity(
      this.db,
      { get: (r: { get: () => unknown }) => r.get() } as never,
      userId,
      organizationId,
    );
    if (
      !identity ||
      !can(identity.permission, 'confirm_hire', {
        organizationId,
        jobId: String(app.jobId ?? ''),
      })
    )
      return failure('FORBIDDEN');
    const hireRef = this.db.collection('hires').doc(applicationId);
    const jobRef = this.db.collection('jobs').doc(String(app.jobId));
    return this.run(async (tx) => {
      const [hireSnap, appSnap, jobSnap, accepted, activeHires] =
        await Promise.all([
          tx.get(hireRef),
          tx.get(appRef),
          tx.get(jobRef),
          tx.get(
            this.db
              .collection('offers')
              .where('applicationId', '==', applicationId)
              .where('v2Status', '==', 'ACCEPTED')
              .limit(1),
          ),
          tx.get(
            this.db
              .collection('hires')
              .where('jobId', '==', String(app.jobId))
              .where('status', '==', 'ACTIVE'),
          ),
        ]);
      const job = jobSnap.data() ?? {};
      const vacancies =
        Number(job.vacanciesCount ?? job.vagasDisponiveis ?? 1) || 1;
      if (hireSnap.exists) {
        const summary = positionsSummary(vacancies, activeHires.size);
        return {
          hireId: hireRef.id,
          replayed: true,
          positions: summary.label,
          proposeFilled: summary.proposeFilled,
        };
      }
      const data = appSnap.data() ?? {};
      let from = String(data.v2Status) as ApplicationStatus;
      const viaOffer = from === 'OFFER';
      if (viaOffer && accepted.empty)
        throw new Abort(
          'TRANSITION_GUARD_FAILED',
          'A proposta ainda não foi aceite pelo candidato.',
        );
      const steps = PATHS[from];
      if (!steps) throw new Abort('INVALID_TRANSITION');
      let version = Number(data.version) || 0;
      for (const to of steps) {
        const actor: TransitionActor = viaOffer
          ? 'SYSTEM'
          : identity.transition;
        const check = assertApplication(from, to, actor, {
          guards: {
            hireConfirmed: true,
            acceptedOfferAndHireConfirmed: viaOffer && !accepted.empty,
          },
        });
        if (!check.ok) throw new Abort(check.error.code);
        version += 1;
        tx.create(this.db.collection('applicationsStatusHistory').doc(), {
          entityId: applicationId,
          from,
          to,
          actorId: userId,
          actorType: actor,
          reason: viaOffer ? 'OFFER_ACCEPTED_AND_CONFIRMED' : 'DIRECT_MARK',
          version,
          at: this.at(),
        });
        from = to;
      }
      const legacy = legacyStatusUpdate('Application', 'HIRED');
      tx.update(appRef, {
        ...(legacy.ok ? legacy.value : {}),
        v2Status: 'HIRED',
        version,
        lastStatusChangeAt: this.at(),
        updatedAt: this.at(),
        updatedBy: userId,
      });
      tx.create(hireRef, {
        applicationId,
        jobId: data.jobId ?? null,
        organizationId,
        candidateUserId: data.candidateUserId ?? data.candidateId ?? null,
        startDate: startDate ? Timestamp.fromMillis(startDate.getTime()) : null,
        confirmedByEmployerAt: this.at(),
        confirmedBy: userId,
        candidateConfirmation: 'PENDING',
        confirmationRequestedAt: null,
        attributionSource:
          typeof data.source === 'string' ? data.source : 'direct',
        source: viaOffer ? 'OFFER' : 'DIRECT_MARK',
        status: 'ACTIVE',
        v2Status: 'ACTIVE',
        version: 1,
        createdAt: this.at(),
      });
      tx.create(this.db.collection('hiresStatusHistory').doc(), {
        entityId: hireRef.id,
        from: null,
        to: 'ACTIVE',
        actorId: userId,
        actorType: identity.transition,
        version: 1,
        at: this.at(),
      });
      this.event(tx, 'entity_status_changed', {
        entityId: applicationId,
        entityKind: 'Application',
        version,
      });
      this.event(tx, 'entity_status_changed', {
        entityId: hireRef.id,
        entityKind: 'Hire',
        version: 1,
      });
      const summary = positionsSummary(vacancies, activeHires.size + 1);
      if (jobSnap.exists)
        tx.update(jobRef, {
          hiresCount: activeHires.size + 1,
          ...(summary.proposeFilled ? { fillProposedAt: this.at() } : {}),
        });
      return {
        hireId: hireRef.id,
        replayed: false,
        positions: summary.label,
        proposeFilled: summary.proposeFilled,
      };
    });
  }

  /** E5.3 — «Começou a trabalhar na <org>?». DISPUTED abre caso P3. */
  async candidateRespond(
    candidateUserId: string,
    hireId: string,
    answer: unknown,
  ): Promise<Result<{ candidateConfirmation: CandidateConfirmation }>> {
    if (
      !validDocumentId(hireId) ||
      !(CANDIDATE_ANSWERS as readonly unknown[]).includes(answer)
    )
      return failure('INVALID_INPUT');
    const ref = this.db.collection('hires').doc(hireId);
    return this.run(async (tx) => {
      const hire = (await tx.get(ref)).data();
      if (!hire || hire.candidateUserId !== candidateUserId)
        throw new Abort('NOT_FOUND');
      if (
        hire.status !== 'ACTIVE' ||
        !['PENDING', 'NO_RESPONSE'].includes(String(hire.candidateConfirmation))
      )
        throw new Abort('INVALID_TRANSITION');
      tx.update(ref, {
        candidateConfirmation: answer,
        candidateConfirmedAt: this.at(),
      });
      if (answer === 'DISPUTED')
        tx.create(this.db.collection('moderationCases').doc(), {
          targetType: 'APPLICATION',
          targetId: String(hire.applicationId),
          openedBy: 'HIRE_DISPUTE',
          reportIds: [],
          priority: 'P3',
          v2Status: 'OPEN',
          version: 1,
          assigneeId: null,
          decision: null,
          createdAt: this.at(),
          updatedAt: this.at(),
        });
      return { candidateConfirmation: answer as CandidateConfirmation };
    });
  }

  /** E4 — anulação: só ADMIN, com motivo; candidatura → REJECTED/HIRE_ANNULLED. */
  async annul(
    adminUserId: string,
    hireId: string,
    reason: unknown,
  ): Promise<Result<{ status: 'ANNULLED' }>> {
    const text = typeof reason === 'string' ? reason.trim() : '';
    if (!validDocumentId(hireId)) return failure('INVALID_INPUT');
    const admin = (
      await this.db.collection('users').doc(adminUserId).get()
    ).data();
    if (admin?.userType !== 'admin') return failure('FORBIDDEN');
    const hireRef = this.db.collection('hires').doc(hireId);
    return this.run(async (tx) => {
      const hire = (await tx.get(hireRef)).data();
      if (!hire) throw new Abort('NOT_FOUND');
      const appRef = this.db
        .collection('applications')
        .doc(String(hire.applicationId));
      const app = (await tx.get(appRef)).data();
      const hireCheck = assertHire(hire.status, 'ANNULLED', 'ADMIN', {
        reason: text,
      });
      if (!hireCheck.ok) throw new Abort(hireCheck.error.code);
      const appCheck = assertApplication(
        app?.v2Status as ApplicationStatus,
        'REJECTED',
        'ADMIN',
        {
          reason: text,
          guards: { hireAnnulled: true, hasClosedReason: true },
        },
      );
      if (!app || !appCheck.ok) throw new Abort('INVALID_TRANSITION');
      const version = (Number(app.version) || 0) + 1;
      tx.update(hireRef, {
        status: 'ANNULLED',
        v2Status: 'ANNULLED',
        version: (Number(hire.version) || 1) + 1,
        annulledAt: this.at(),
        annulledBy: adminUserId,
      });
      tx.update(appRef, {
        status: 'rejected',
        v2Status: 'REJECTED',
        closedReason: 'HIRE_ANNULLED',
        version,
        lastStatusChangeAt: this.at(),
      });
      tx.create(this.db.collection('applicationsStatusHistory').doc(), {
        entityId: appRef.id,
        from: 'HIRED',
        to: 'REJECTED',
        actorId: adminUserId,
        actorType: 'ADMIN',
        reason: text,
        closedReason: 'HIRE_ANNULLED',
        version,
        at: this.at(),
      });
      tx.create(this.db.collection('auditLogs').doc(), {
        actorId: adminUserId,
        actorType: 'ADMIN',
        action: 'hire_annulled',
        resourceType: 'Hire',
        resourceId: hireId,
        organizationId: hire.organizationId ?? null,
        metadata: { applicationId: appRef.id },
        at: this.at(),
      });
      this.event(tx, 'entity_status_changed', {
        entityId: appRef.id,
        entityKind: 'Application',
        version,
      });
      return { status: 'ANNULLED' as const };
    });
  }

  /** D12 `hireConfirmationFollowUp` (diário): pedidos aos 30 dias e NO_RESPONSE aos 14. */
  async followUp(
    limit = 100,
  ): Promise<{ requested: number; noResponse: number }> {
    const result = { requested: 0, noResponse: 0 };
    const pending = await this.db
      .collection('hires')
      .where('status', '==', 'ACTIVE')
      .where('candidateConfirmation', '==', 'PENDING')
      .limit(limit)
      .get();
    for (const doc of pending.docs) {
      const outcome = await this.db.runTransaction(async (tx) => {
        const hire = (await tx.get(doc.ref)).data();
        if (!hire) return null;
        const stage = hireFollowUpStage(
          {
            status: String(hire.status),
            candidateConfirmation:
              hire.candidateConfirmation as CandidateConfirmation,
            startDate: toDate(hire.startDate),
            confirmedByEmployerAt:
              toDate(hire.confirmedByEmployerAt) ?? new Date(this.now()),
            confirmationRequestedAt: toDate(hire.confirmationRequestedAt),
          },
          new Date(this.now()),
        );
        if (stage === 'REQUEST') {
          tx.update(doc.ref, { confirmationRequestedAt: this.at() });
          this.event(tx, 'hire_confirmation_request', {
            hireId: doc.id,
            stage: 'REQUEST',
          });
        } else if (stage === 'NO_RESPONSE')
          tx.update(doc.ref, { candidateConfirmation: 'NO_RESPONSE' });
        return stage;
      });
      if (outcome === 'REQUEST') result.requested++;
      if (outcome === 'NO_RESPONSE') result.noResponse++;
    }
    return result;
  }
}
