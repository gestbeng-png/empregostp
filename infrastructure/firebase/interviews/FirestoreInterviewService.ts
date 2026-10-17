import { Timestamp } from 'firebase-admin/firestore';
import type {
  DocumentReference,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';

import type {
  FeatureFlagReader,
  ResolvedIdentity,
} from '@/application/marketplace/ports';
import { assertTransition as assertApplication } from '@/domain/applications/states';
import type { ApplicationStatus } from '@/domain/applications/states';
import type { FeatureContext } from '@/domain/feature-flags/flags';
import {
  buildInterviewIcs,
  candidateInterviewView,
  RESCHEDULE_WARNING_COUNT,
  validateInterviewInput,
} from '@/domain/interviews/schedule';
import type { CandidateInterviewView } from '@/domain/interviews/schedule';
import { assertTransition as assertInterview } from '@/domain/interviews/states';
import type { InterviewStatus } from '@/domain/interviews/states';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';
import type { TransitionActor } from '@/domain/lifecycle/states';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { resolveIdentity } from '../marketplace/FirestoreLifecycleStore';
import { digest, validDocumentId } from '../marketplace/identifiers';

type Plain = Record<string, unknown>;
type MoveResult = Promise<
  Result<{ status: InterviewStatus; version: number; warning: string | null }>
>;
const RECOMMENDATIONS = ['AVANCAR', 'DUVIDA', 'NAO_AVANCAR'] as const;

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

/**
 * E6 — ciclo de vida das entrevistas. Cada operação: uma transação que valida
 * a transição na máquina de estados, grava a entrevista, o histórico e um
 * evento na outbox (o dispatcher envia notificações e o .ics). Marcar a
 * entrevista também passa a candidatura a INTERVIEW (com UNDER_REVIEW
 * intermédio se ainda estava SUBMITTED) na mesma transação.
 */
export class FirestoreInterviewService {
  constructor(
    private readonly db: Firestore,
    private readonly flags: FeatureFlagReader,
    private readonly context: FeatureContext,
    private readonly now: () => number = Date.now,
  ) {}

  private async identity(
    userId: string,
    organizationId: string,
  ): Promise<ResolvedIdentity | undefined> {
    return resolveIdentity(
      this.db,
      { get: (ref: { get: () => unknown }) => ref.get() } as never,
      userId,
      organizationId,
    );
  }

  private event(
    tx: Transaction,
    entityId: string,
    entityKind: 'Interview' | 'Application',
    version: number,
  ) {
    tx.create(this.db.collection('outboxEvents').doc(), {
      type: 'entity_status_changed',
      schemaVersion: 1,
      payload: { entityId, entityKind, version },
      status: 'PENDING',
      attempts: 0,
      createdAtMs: this.now(),
      nextAttemptAtMs: this.now(),
    });
  }

  private history(
    tx: Transaction,
    collection: string,
    entityId: string,
    entry: Plain,
  ) {
    tx.create(this.db.collection(collection).doc(), {
      entityId,
      ...entry,
      at: Timestamp.fromMillis(this.now()),
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

  async schedule(
    userId: string,
    applicationId: string,
    raw: unknown,
    idempotencyKey: string,
  ): Promise<Result<{ interviewId: string; replayed: boolean }>> {
    if (
      !validDocumentId(applicationId) ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)
    )
      return failure('INVALID_INPUT');
    const input = validateInterviewInput(raw, new Date(this.now()));
    if (!input.ok) return failure('INVALID_INPUT', input.message);
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
      !(await this.flags.enabled('V2_INTERVIEWS_OFFERS', {
        ...this.context,
        organizationId,
        userId,
      }))
    )
      return failure('FEATURE_DISABLED');
    const identity = await this.identity(userId, organizationId);
    if (
      !identity ||
      !can(identity.permission, 'interview_offer', {
        organizationId,
        jobId: String(app.jobId ?? ''),
      })
    )
      return failure('FORBIDDEN');
    // D8: id determinístico pela chave → duplo clique devolve a mesma entrevista.
    const interviewRef = this.db
      .collection('interviews')
      .doc(digest(['interview', userId, idempotencyKey]).slice(0, 28));
    const v = input.value;
    return this.run(async (tx) => {
      const [existing, fresh] = await Promise.all([
        tx.get(interviewRef),
        tx.get(appRef),
      ]);
      if (existing.exists) {
        if (existing.data()?.applicationId !== applicationId)
          throw new Abort('IDEMPOTENCY_CONFLICT');
        return { interviewId: interviewRef.id, replayed: true };
      }
      const data = fresh.data() ?? {};
      let status = String(data.v2Status) as ApplicationStatus;
      const path: ApplicationStatus[] =
        status === 'SUBMITTED'
          ? ['UNDER_REVIEW', 'INTERVIEW']
          : status === 'INTERVIEW'
            ? []
            : ['INTERVIEW'];
      let version = Number(data.version) || 0;
      for (const to of path) {
        if (!assertApplication(status, to, identity.transition).ok)
          throw new Abort('INVALID_TRANSITION');
        version += 1;
        this.history(tx, 'applicationsStatusHistory', applicationId, {
          from: status,
          to,
          actorId: userId,
          actorType: identity.transition,
          reason: null,
          version,
        });
        status = to;
      }
      const startsAt = Timestamp.fromMillis(v.startsAt.getTime());
      tx.create(interviewRef, {
        applicationId,
        organizationId,
        jobId: data.jobId ?? null,
        candidateUserId: data.candidateUserId ?? null,
        type: v.type,
        startsAt,
        durationMin: v.durationMin,
        timezone: v.timezone,
        location: v.location,
        meetingUrl: v.meetingUrl,
        interviewerUserIds: v.interviewerUserIds,
        candidateMessage: v.candidateMessage,
        internalNotes: null,
        rescheduleCount: 0,
        remindersSent: [],
        v2Status: 'SCHEDULED',
        version: 1,
        createdAt: Timestamp.fromMillis(this.now()),
        createdBy: userId,
      });
      this.history(tx, 'interviewsStatusHistory', interviewRef.id, {
        from: null,
        to: 'SCHEDULED',
        actorId: userId,
        actorType: identity.transition,
        reason: null,
        version: 1,
      });
      this.event(tx, interviewRef.id, 'Interview', 1);
      if (path.length) {
        const legacy = legacyStatusUpdate('Application', 'INTERVIEW');
        tx.update(appRef, {
          ...(legacy.ok ? legacy.value : {}),
          v2Status: 'INTERVIEW',
          version,
          lastStatusChangeAt: Timestamp.fromMillis(this.now()),
          ...(data.firstViewedAt
            ? {}
            : { firstViewedAt: Timestamp.fromMillis(this.now()) }),
          // Painéis atuais do candidato leem `interviewDetails`.
          interviewDetails: {
            interviewId: interviewRef.id,
            scheduledAt: v.startsAt.toISOString(),
            mode: v.type === 'PRESENCIAL' ? 'presencial' : 'online',
            location: v.location ?? '',
            link: v.meetingUrl ?? '',
            notes: v.candidateMessage ?? '',
            status: 'scheduled',
          },
          updatedAt: Timestamp.fromMillis(this.now()),
          updatedBy: userId,
        });
        this.event(tx, applicationId, 'Application', version);
      }
      return { interviewId: interviewRef.id, replayed: false };
    });
  }

  /** Transição genérica de uma entrevista existente. */
  private async move(
    interviewId: string,
    actor: (
      interview: Plain,
    ) => Promise<{ userId: string; transition: TransitionActor } | null>,
    to: InterviewStatus,
    build: (interview: Plain) => {
      guards?: Record<string, boolean>;
      reason?: string;
      fields?: Plain;
    },
  ): Promise<
    Result<{ status: InterviewStatus; version: number; warning: string | null }>
  > {
    if (!validDocumentId(interviewId)) return failure('INVALID_INPUT');
    const ref: DocumentReference = this.db
      .collection('interviews')
      .doc(interviewId);
    const current = (await ref.get()).data();
    if (!current) return failure('NOT_FOUND');
    if (
      !(await this.flags.enabled('V2_INTERVIEWS_OFFERS', {
        ...this.context,
        organizationId: String(current.organizationId),
      }))
    )
      return failure('FEATURE_DISABLED');
    const who = await actor(current);
    if (!who) return failure('FORBIDDEN');
    return this.run(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (!data) throw new Abort('NOT_FOUND');
      const spec = build(data);
      const check = assertInterview(
        data.v2Status as InterviewStatus,
        to,
        who.transition,
        {
          guards: spec.guards,
          reason: spec.reason,
        },
      );
      if (!check.ok) throw new Abort(check.error.code, check.error.message);
      const version = (Number(data.version) || 0) + 1;
      tx.update(ref, {
        ...spec.fields,
        v2Status: to,
        version,
        updatedAt: Timestamp.fromMillis(this.now()),
        updatedBy: who.userId,
      });
      this.history(tx, 'interviewsStatusHistory', interviewId, {
        from: data.v2Status,
        to,
        actorId: who.userId,
        actorType: who.transition,
        reason: spec.reason ?? null,
        version,
      });
      this.event(tx, interviewId, 'Interview', version);
      const count =
        Number(spec.fields?.rescheduleCount ?? data.rescheduleCount) || 0;
      return {
        status: to,
        version,
        warning:
          count >= RESCHEDULE_WARNING_COUNT
            ? `Esta entrevista já foi reagendada ${count} vezes.`
            : null,
      };
    });
  }

  private candidate(userId: string) {
    return async (interview: Plain) =>
      interview.candidateUserId === userId
        ? { userId, transition: 'CANDIDATE' as TransitionActor }
        : null;
  }

  private organization(userId: string) {
    return async (interview: Plain) => {
      const identity = await this.identity(
        userId,
        String(interview.organizationId),
      );
      return identity &&
        can(identity.permission, 'interview_offer', {
          organizationId: String(interview.organizationId),
          jobId: String(interview.jobId ?? ''),
        })
        ? { userId, transition: identity.transition }
        : null;
    };
  }

  confirm(candidateUserId: string, interviewId: string): MoveResult {
    return this.move(
      interviewId,
      this.candidate(candidateUserId),
      'CONFIRMED',
      () => ({}),
    );
  }

  requestReschedule(
    candidateUserId: string,
    interviewId: string,
    proposal: unknown,
  ): MoveResult {
    const text =
      typeof proposal === 'string' ? proposal.trim().slice(0, 500) : '';
    return this.move(
      interviewId,
      this.candidate(candidateUserId),
      'RESCHEDULE_REQUESTED',
      () => ({
        guards: { hasRescheduleProposal: text.length >= 3 },
        fields: { rescheduleProposal: text },
      }),
    );
  }

  reschedule(userId: string, interviewId: string, raw: unknown): MoveResult {
    const input = validateInterviewInput(raw, new Date(this.now()));
    return this.move(
      interviewId,
      this.organization(userId),
      'SCHEDULED',
      (interview) => ({
        guards: { hasNewInterviewTime: input.ok },
        fields: input.ok
          ? {
              startsAt: Timestamp.fromMillis(input.value.startsAt.getTime()),
              durationMin: input.value.durationMin,
              timezone: input.value.timezone,
              location: input.value.location,
              meetingUrl: input.value.meetingUrl,
              rescheduleCount: (Number(interview.rescheduleCount) || 0) + 1,
              rescheduleProposal: null,
              remindersSent: [],
            }
          : {},
      }),
    );
  }

  cancel(
    actorUserId: string,
    interviewId: string,
    reason: unknown,
    side: 'CANDIDATE' | 'ORGANIZATION',
  ): MoveResult {
    const text = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
    return this.move(
      interviewId,
      side === 'CANDIDATE'
        ? this.candidate(actorUserId)
        : this.organization(actorUserId),
      'CANCELLED',
      () => ({
        reason: text || undefined,
        fields: { cancelReason: text || null },
      }),
    );
  }

  /** COMPLETED ou NO_SHOW: só depois da hora marcada. */
  finish(
    userId: string,
    interviewId: string,
    outcome: 'COMPLETED' | 'NO_SHOW',
  ): MoveResult {
    return this.move(
      interviewId,
      this.organization(userId),
      outcome,
      (interview) => ({
        guards: {
          interviewStarted:
            (toDate(interview.startsAt)?.getTime() ?? Infinity) <= this.now(),
        },
      }),
    );
  }

  /** E6/F3.5: feedback estruturado — interno, um por entrevistador. */
  async feedback(
    userId: string,
    interviewId: string,
    input: { recommendation?: unknown; notes?: unknown },
  ): Promise<Result<{ saved: true }>> {
    if (!validDocumentId(interviewId)) return failure('INVALID_INPUT');
    const interview = (
      await this.db.collection('interviews').doc(interviewId).get()
    ).data();
    if (!interview) return failure('NOT_FOUND');
    const identity = await this.identity(
      userId,
      String(interview.organizationId),
    );
    if (
      !identity ||
      !can(identity.permission, 'internal_notes', {
        organizationId: String(interview.organizationId),
      })
    )
      return failure('FORBIDDEN');
    if (!(RECOMMENDATIONS as readonly unknown[]).includes(input.recommendation))
      return failure('INVALID_INPUT');
    const notes =
      typeof input.notes === 'string' ? input.notes.trim().slice(0, 2000) : '';
    await this.db
      .collection('interviewFeedback')
      .doc(`${interviewId}_${userId}`)
      .set({
        interviewId,
        applicationId: interview.applicationId ?? null,
        organizationId: interview.organizationId,
        authorId: userId,
        recommendation: input.recommendation,
        notes,
        updatedAt: Timestamp.fromMillis(this.now()),
      });
    return success({ saved: true });
  }

  /** .ics para o candidato ou para a organização; vista do candidato à parte. */
  async calendar(
    userId: string,
    interviewId: string,
  ): Promise<Result<{ ics: string; view: CandidateInterviewView }>> {
    if (!validDocumentId(interviewId)) return failure('INVALID_INPUT');
    const interview = (
      await this.db.collection('interviews').doc(interviewId).get()
    ).data();
    if (!interview) return failure('NOT_FOUND');
    const allowed =
      interview.candidateUserId === userId ||
      Boolean(await this.organization(userId)(interview));
    if (!allowed) return failure('NOT_FOUND');
    const app =
      (
        await this.db
          .collection('applications')
          .doc(String(interview.applicationId))
          .get()
      ).data() ?? {};
    const job = (app.jobSnapshot ?? {}) as Plain;
    const startsAt = toDate(interview.startsAt) ?? new Date(this.now());
    return success({
      ics: buildInterviewIcs({
        interviewId,
        title: String(job.titulo ?? job.title ?? app.jobTitle ?? 'Entrevista'),
        organizationName: String(
          job.companyName ?? app.company ?? 'EmpregoSTP',
        ),
        startsAt,
        durationMin: Number(interview.durationMin) || 30,
        location: (interview.location as string) ?? null,
        meetingUrl: (interview.meetingUrl as string) ?? null,
        description: (interview.candidateMessage as string) ?? null,
        sequence: Number(interview.rescheduleCount) || 0,
        cancelled: interview.v2Status === 'CANCELLED',
        now: new Date(this.now()),
      }),
      view: candidateInterviewView({ ...interview, id: interviewId }),
    });
  }
}
