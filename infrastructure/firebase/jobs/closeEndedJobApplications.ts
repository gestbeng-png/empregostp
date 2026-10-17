import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type { FeatureFlagReader } from '@/application/marketplace/ports';
import {
  DEFAULT_REJECTION_TEMPLATES,
  planJobEndClosures,
  renderCandidateTemplate,
} from '@/domain/applications/jobEnd';
import type { CloseOutcome, JobEndState } from '@/domain/applications/jobEnd';
import { assertTransition } from '@/domain/applications/states';
import type { ApplicationStatus } from '@/domain/applications/states';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';

import { getFeatureEnvironment } from '../marketplace/environment';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

/** Estados legados ainda abertos → equivalente v2 (só para decidir). */
const LEGACY_OPEN: Readonly<Record<string, ApplicationStatus>> = {
  pending: 'SUBMITTED',
  analysis: 'UNDER_REVIEW',
  interview: 'INTERVIEW',
};
const END_STATES = new Set<JobEndState>(['CLOSED', 'FILLED', 'EXPIRED']);

function statusOf(
  data: Readonly<Record<string, unknown>>,
): ApplicationStatus | null {
  if (typeof data.v2Status === 'string')
    return data.v2Status as ApplicationStatus;
  return LEGACY_OPEN[String(data.status ?? 'pending').toLowerCase()] ?? null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string' || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export interface JobEndRunResult {
  jobsScanned: number;
  jobsCompleted: number;
  jobsWaiting: number;
  applicationsClosed: number;
}

/**
 * F2.8 — candidaturas abertas em vagas terminadas: passam a REJECTED com o
 * motivo do fecho (POSITION_*) no máximo 7 dias depois, com a mensagem
 * respeitosa F3.6 (ou a do empregador). Cada candidatura numa transação
 * própria, idempotente: relida e só fechada se ainda estiver aberta.
 */
export async function closeEndedJobApplications(
  db: Firestore,
  now: Date,
  options: { flags?: FeatureFlagReader; limit?: number } = {},
): Promise<JobEndRunResult> {
  const flags = options.flags ?? new FirestoreFeatureFlags(db);
  const result: JobEndRunResult = {
    jobsScanned: 0,
    jobsCompleted: 0,
    jobsWaiting: 0,
    applicationsClosed: 0,
  };
  const jobs = await db
    .collection('jobs')
    .where('jobEndPending', '==', true)
    .limit(options.limit ?? 50)
    .get();
  for (const jobDoc of jobs.docs) {
    result.jobsScanned++;
    const job = jobDoc.data();
    const organizationId = String(job.organizationId ?? job.companyId ?? '');
    if (
      !(await flags.enabled('V2_JOB_LIFECYCLE', {
        environment: getFeatureEnvironment(),
        organizationId: organizationId || undefined,
        userId: organizationId || undefined,
      }))
    )
      continue;
    const state = END_STATES.has(job.jobEndState)
      ? (job.jobEndState as JobEndState)
      : 'CLOSED';
    const endedAt = toDate(job.jobEndedAt) ?? now;
    const applications = await db
      .collection('applications')
      .where('jobId', '==', jobDoc.id)
      .get();
    const plan = planJobEndClosures({
      state,
      outcome: (job.closeOutcome as CloseOutcome | undefined) ?? null,
      endedAt,
      now,
      employerMessageConfirmed: job.jobEndMessageConfirmed === true,
      applications: applications.docs
        .map((doc) => ({ id: doc.id, status: statusOf(doc.data()) }))
        .filter((item): item is { id: string; status: ApplicationStatus } =>
          Boolean(item.status),
        ),
    });
    if (plan.waitingForEmployer.length) {
      result.jobsWaiting++;
      continue;
    }
    const template =
      typeof job.jobEndMessage === 'string' && job.jobEndMessage.trim()
        ? job.jobEndMessage
        : DEFAULT_REJECTION_TEMPLATES.PROCESS_CLOSED;
    for (const item of plan.due) {
      const appRef = db.collection('applications').doc(item.applicationId);
      const historyRef = db.collection('applicationsStatusHistory').doc();
      const eventRef = db.collection('outboxEvents').doc();
      const notificationRef = db.collection('notifications').doc();
      const closed = await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(appRef);
        const data = snapshot.data();
        if (!data) return null;
        const current = statusOf(data);
        if (
          !current ||
          !['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW'].includes(
            current,
          )
        )
          return null;
        const message = renderCandidateTemplate(template, {
          nome:
            String(
              data.candidateSnapshot?.fullName ?? data.candidateName ?? '',
            ).split(' ')[0] ?? '',
          vaga: String(job.titulo ?? job.title ?? data.jobTitle ?? ''),
          organizacao: String(job.companyName ?? data.company ?? ''),
        });
        const timelineEvent = {
          title: 'Processo encerrado',
          description: message,
          icon: '📭',
          date: now.toISOString(),
          by: 'system:jobEnd',
          byType: 'sistema',
        };
        const common = {
          closedReason: item.closedReason,
          lastStatusChangeAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now),
          updatedBy: 'system:jobEnd',
          timeline: FieldValue.arrayUnion(timelineEvent),
        };
        if (typeof data.v2Status === 'string') {
          const allowed = assertTransition(current, 'REJECTED', 'SYSTEM', {
            guards: { hasClosedReason: true },
          });
          const legacy = legacyStatusUpdate('Application', 'REJECTED');
          if (!allowed.ok || !legacy.ok) return null;
          const version =
            (Number.isSafeInteger(data.version) ? data.version : 0) + 1;
          tx.update(appRef, {
            ...common,
            ...legacy.value,
            v2Status: 'REJECTED',
            version,
          });
          tx.create(historyRef, {
            entityId: appRef.id,
            from: current,
            to: 'REJECTED',
            actorId: 'system:jobEnd',
            actorType: 'SYSTEM',
            closedReason: item.closedReason,
            candidateVisibleNote: message,
            reason: item.closedReason,
            at: Timestamp.fromDate(now),
            version,
          });
          tx.create(eventRef, {
            type: 'entity_status_changed',
            schemaVersion: 1,
            payload: {
              entityId: appRef.id,
              entityKind: 'Application',
              version,
            },
            status: 'PENDING',
            attempts: 0,
            createdAtMs: now.getTime(),
            nextAttemptAtMs: now.getTime(),
          });
        } else {
          // Candidatura legada: só o estado legado (não se cria v2Status).
          tx.update(appRef, { ...common, status: 'rejected' });
        }
        const candidateId = String(
          data.candidateUserId ?? data.candidateId ?? '',
        );
        // A falha desta escrita deve reverter também o fecho. Uma repetição
        // encontra a candidatura aberta e pode entregar a notificação.
        if (candidateId)
          tx.create(notificationRef, {
            userId: candidateId,
            title: 'Processo encerrado',
            message,
            type: 'application',
            icon: '📭',
            read: false,
            relatedId: item.applicationId,
            relatedJobId: jobDoc.id,
            actionUrl: '/dashboard/candidato?tab=applications',
            createdAt: Timestamp.fromDate(now),
          });
        return true;
      });
      if (!closed) continue;
      result.applicationsClosed++;
    }
    await jobDoc.ref.update({
      jobEndPending: false,
      jobEndApplicationsClosedAt: Timestamp.fromDate(now),
    });
    result.jobsCompleted++;
  }
  return result;
}
