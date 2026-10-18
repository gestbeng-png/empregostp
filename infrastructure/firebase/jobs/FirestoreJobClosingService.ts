import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { ResolvedIdentity } from '@/application/marketplace/ports';
import {
  CLOSE_OUTCOMES,
  DEFAULT_REJECTION_TEMPLATES,
  JOB_END_GRACE_DAYS,
  renderCandidateTemplate,
} from '@/domain/applications/jobEnd';
import type { CloseOutcome } from '@/domain/applications/jobEnd';
import { readJobLifecycle } from '@/domain/jobs/legacyView';
import { assertTransition as assertJob } from '@/domain/jobs/states';
import type { JobStatus } from '@/domain/jobs/states';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { resolveIdentity } from '../marketplace/FirestoreLifecycleStore';
import { validDocumentId } from '../marketplace/identifiers';

type Plain = Record<string, unknown>;
const DAY_MS = 86_400_000;
const MAX_MESSAGE = 1500;

class Abort extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** F3.6: só {nome}, {vaga}, {organizacao}; nunca um motivo de rejeição detalhado. */
export function validateCandidateMessage(message: unknown): string | null {
  if (typeof message !== 'string') return null;
  const text = message.trim();
  if (text.length < 20 || text.length > MAX_MESSAGE) return null;
  const vars = [...text.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  return vars.every((v) => v === 'nome' || v === 'vaga' || v === 'organizacao')
    ? text
    : null;
}

/**
 * F1.9/F3.8/F2.8 — fecho da vaga pela organização. Funciona em vagas v2 e
 * legadas (escrita dupla só onde já existe `v2Status`). O fecho marca
 * `jobEndPending`: o cron trata as candidaturas abertas ao 7.º dia, ou antes
 * se o empregador confirmar a mensagem.
 */
export class FirestoreJobClosingService {
  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  private at() {
    return Timestamp.fromMillis(this.now());
  }

  private async authorize(
    userId: string,
    jobId: string,
  ): Promise<
    Result<{ job: Plain; organizationId: string; identity: ResolvedIdentity }>
  > {
    if (!validDocumentId(jobId)) return failure('NOT_FOUND');
    const job = (await this.db.collection('jobs').doc(jobId).get()).data();
    if (!job) return failure('NOT_FOUND');
    const organizationId = readJobLifecycle(job).organizationId;
    if (!organizationId) return failure('NOT_FOUND');
    const identity = await resolveIdentity(
      this.db,
      { get: (r: { get: () => unknown }) => r.get() } as never,
      userId,
      organizationId,
    );
    if (
      !identity ||
      !can(identity.permission, 'publish_close_job', { organizationId, jobId })
    )
      return failure('FORBIDDEN');
    return success({ job, organizationId, identity });
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

  private end(
    tx: Transaction,
    jobId: string,
    job: Plain,
    to: JobStatus,
    guard: string,
    userId: string,
    identity: ResolvedIdentity,
    fields: Plain,
  ) {
    const ref = this.db.collection('jobs').doc(jobId);
    const view = readJobLifecycle(job);
    const hasLifecycleStatus = typeof job.v2Status === 'string';
    if (!['PUBLISHED', 'PAUSED', 'EXPIRED'].includes(view.status))
      throw new Abort('INVALID_TRANSITION');
    const check = assertJob(view.status, to, identity.transition, {
      guards: { [guard]: true },
    });
    if (hasLifecycleStatus && !check.ok) throw new Abort(check.error.code);
    const legacy = legacyStatusUpdate('Job', to);
    const version = view.version + 1;
    tx.update(ref, {
      ...(legacy.ok ? legacy.value : {}),
      ...(hasLifecycleStatus ? { v2Status: to, version } : {}),
      ...fields,
      destaque: false,
      closedAt: this.at(),
      jobEndState: to,
      jobEndedAt: new Date(this.now()).toISOString(),
      jobEndPending: true,
      jobEndMessageConfirmed: false,
      updatedAt: this.at(),
      updatedBy: userId,
    });
    tx.create(this.db.collection('jobsStatusHistory').doc(), {
      entityId: jobId,
      from: view.status,
      to,
      actorId: userId,
      actorType: identity.transition,
      reason: String(fields.closeOutcome ?? to),
      version,
      at: this.at(),
    });
    tx.create(this.db.collection('outboxEvents').doc(), {
      type: 'entity_status_changed',
      schemaVersion: 1,
      payload: { entityId: jobId, entityKind: 'Job', version },
      status: 'PENDING',
      attempts: 0,
      createdAtMs: this.now(),
      nextAttemptAtMs: this.now(),
    });
  }

  async close(
    userId: string,
    jobId: string,
    input: {
      closeOutcome?: unknown;
      otherText?: unknown;
      improvement?: unknown;
    },
  ): Promise<Result<{ status: 'CLOSED'; openApplicationsCloseAfter: string }>> {
    const outcome = input.closeOutcome as CloseOutcome;
    if (!(CLOSE_OUTCOMES as readonly unknown[]).includes(outcome))
      return failure('INVALID_INPUT', 'Indique o resultado do processo.');
    const otherText =
      typeof input.otherText === 'string'
        ? input.otherText.trim().slice(0, 300)
        : '';
    if (outcome === 'OTHER' && otherText.length < 3)
      return failure('INVALID_INPUT', 'Descreva o resultado.');
    const auth = await this.authorize(userId, jobId);
    if (!auth.ok) return auth;
    const { job, identity } = auth.value;
    return this.run(async (tx) => {
      const fresh =
        (await tx.get(this.db.collection('jobs').doc(jobId))).data() ?? job;
      const hires = await tx.get(
        this.db
          .collection('hires')
          .where('jobId', '==', jobId)
          .where('status', '==', 'ACTIVE')
          .limit(1),
      );
      // F1.9: «contratado via EmpregoSTP» exige pelo menos uma contratação registada.
      if (outcome === 'HIRED_VIA_EMPREGOSTP' && hires.empty)
        throw new Abort(
          'TRANSITION_GUARD_FAILED',
          'Selecione primeiro o candidato contratado no processo.',
        );
      this.end(
        tx,
        jobId,
        fresh,
        'CLOSED',
        'hasCloseOutcome',
        userId,
        identity,
        {
          closeOutcome: outcome,
          closeOutcomeText: outcome === 'OTHER' ? otherText : null,
          closeFeedback:
            typeof input.improvement === 'string'
              ? input.improvement.trim().slice(0, 1000)
              : null,
        },
      );
      return {
        status: 'CLOSED' as const,
        openApplicationsCloseAfter: new Date(
          this.now() + JOB_END_GRACE_DAYS * DAY_MS,
        ).toISOString(),
      };
    });
  }

  /** F3.8: o empregador confirma «preenchida» depois da proposta do sistema. */
  async confirmFilled(
    userId: string,
    jobId: string,
  ): Promise<Result<{ status: 'FILLED' }>> {
    const auth = await this.authorize(userId, jobId);
    if (!auth.ok) return auth;
    const { job, identity } = auth.value;
    if (!job.fillProposedAt)
      return failure(
        'TRANSITION_GUARD_FAILED',
        'Ainda há posições por preencher.',
      );
    return this.run(async (tx) => {
      const fresh =
        (await tx.get(this.db.collection('jobs').doc(jobId))).data() ?? job;
      this.end(
        tx,
        jobId,
        fresh,
        'FILLED',
        'allPositionsFilled',
        userId,
        identity,
        {
          closeOutcome: 'HIRED_VIA_EMPREGOSTP',
        },
      );
      return { status: 'FILLED' as const };
    });
  }

  /** Pré-visualização da mensagem (F3.2/F3.6: nunca enviar sem ver). */
  async previewClosingMessage(
    userId: string,
    jobId: string,
    message: unknown,
  ): Promise<Result<{ preview: string; template: string }>> {
    const auth = await this.authorize(userId, jobId);
    if (!auth.ok) return auth;
    const template =
      message === undefined
        ? DEFAULT_REJECTION_TEMPLATES.PROCESS_CLOSED
        : validateCandidateMessage(message);
    if (!template)
      return failure(
        'INVALID_INPUT',
        'A mensagem só pode usar {nome}, {vaga} e {organizacao} e ter 20 a 1500 caracteres.',
      );
    const job = auth.value.job;
    return success({
      template,
      preview: renderCandidateTemplate(template, {
        nome: 'Ana',
        vaga: String(job.titulo ?? job.title ?? ''),
        organizacao: String(job.companyName ?? ''),
      }),
    });
  }

  /** Confirma a mensagem dentro dos 7 dias: as candidaturas abertas fecham no próximo ciclo. */
  async confirmClosingMessage(
    userId: string,
    jobId: string,
    message: unknown,
  ): Promise<Result<{ confirmed: true }>> {
    const auth = await this.authorize(userId, jobId);
    if (!auth.ok) return auth;
    const template =
      message === undefined
        ? DEFAULT_REJECTION_TEMPLATES.PROCESS_CLOSED
        : validateCandidateMessage(message);
    if (!template) return failure('INVALID_INPUT');
    if (auth.value.job.jobEndPending !== true)
      return failure(
        'INVALID_TRANSITION',
        'A vaga não está a aguardar o fecho das candidaturas.',
      );
    await this.db.collection('jobs').doc(jobId).update({
      jobEndMessage: template,
      jobEndMessageConfirmed: true,
      updatedAt: this.at(),
      updatedBy: userId,
    });
    return success({ confirmed: true });
  }
}
