import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { buildJobSnapshot } from '@/domain/applications/snapshot';
import {
  JOB_INTERNALS_COLLECTION,
  splitJobWrite,
} from '@/domain/jobs/internalFields';
import type { JobSubmissionEvaluation } from '@/domain/jobs/submission';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';

import { digest } from '../marketplace/identifiers';

export type JobPublishOutcome =
  | { kind: 'CREATED'; jobId: string; status: 'PUBLISHED' | 'PENDING_REVIEW' }
  | { kind: 'REPLAYED'; jobId: string; status: string };

/** D8: com chave, o id da vaga é derivado dela — um duplo clique devolve a
 * mesma vaga em vez de criar duas. Sem chave (cliente antigo), id aleatório. */
export function jobIdFor(
  db: Firestore,
  ownerUserId: string,
  idempotencyKey: string | null,
): string {
  return idempotencyKey && /^[a-zA-Z0-9_-]{16,128}$/.test(idempotencyKey)
    ? digest(['job_publish', ownerUserId, idempotencyKey]).slice(0, 28)
    : db.collection('jobs').doc().id;
}

/**
 * D4 — uma transação: vaga (estado legado + v2, campos expandidos), versão
 * 1 (`jobVersions`), campos internos (`jobInternals`, nunca no documento
 * público — SEC-04), histórico, outbox e, com risco ≥ 70, ModerationCase P1.
 */
export async function persistJob(
  db: Firestore,
  input: {
    jobId: string;
    ownerUserId: string;
    payload: Readonly<Record<string, unknown>>;
    evaluation: JobSubmissionEvaluation;
    now: Date;
  },
): Promise<JobPublishOutcome> {
  const { decision, quality, risk, expand } = input.evaluation;
  if (decision.kind === 'BLOCKED') throw new Error('JOB_BLOCKED');
  const status = decision.kind === 'PUBLISH' ? 'PUBLISHED' : 'PENDING_REVIEW';
  const legacy = legacyStatusUpdate('Job', status);
  const jobRef = db.collection('jobs').doc(input.jobId);
  const versionId = `${input.jobId}_v1`;
  const versionRef = db.collection('jobVersions').doc(versionId);
  const internalsRef = db.collection(JOB_INTERNALS_COLLECTION).doc(input.jobId);
  const historyRef = db.collection('jobsStatusHistory').doc();
  const eventRef = db.collection('outboxEvents').doc();
  const caseRef = db.collection('moderationCases').doc();
  const at = Timestamp.fromDate(input.now);

  return db.runTransaction(async (tx): Promise<JobPublishOutcome> => {
    const existing = await tx.get(jobRef);
    const prior = existing.data();
    if (prior)
      return {
        kind: 'REPLAYED',
        jobId: input.jobId,
        status: String(prior.v2Status ?? prior.status ?? ''),
      };
    const { publicFields } = splitJobWrite({
      ...input.payload,
      ...expand.fields,
    });
    const document = {
      ...publicFields,
      ...(legacy.ok ? legacy.value : {}),
      v2Status: status,
      version: 1,
      currentVersionId: versionId,
      ownerUserId: input.ownerUserId,
      // F2.1: nenhuma vantagem paga para candidatos nas vagas v2.
      premiumOnly: false,
      earlyAccessHours: 0,
      earlyAccessUntil: null,
      publishedAt: status === 'PUBLISHED' ? at : null,
      createdAt: at,
      updatedAt: at,
      createdBy: input.ownerUserId,
      updatedBy: input.ownerUserId,
    };
    tx.create(jobRef, document);
    tx.create(versionRef, {
      jobId: input.jobId,
      versionNumber: 1,
      snapshot: buildJobSnapshot(input.jobId, document, versionId),
      createdAt: at,
      createdBy: input.ownerUserId,
    });
    tx.create(internalsRef, {
      qualityScore: quality.score,
      qualityBreakdown: quality.breakdown,
      riskScore: risk.score,
      riskSignals: risk.signals,
      dataReview: expand.review,
      reviewReasons: decision.kind === 'REVIEW' ? decision.reasons : [],
      updatedAt: at,
    });
    tx.create(historyRef, {
      entityId: input.jobId,
      from: 'DRAFT',
      to: status,
      actorId: input.ownerUserId,
      actorType: 'EMPLOYER',
      reason: decision.kind === 'REVIEW' ? decision.reasons.join(',') : null,
      at,
      version: 1,
    });
    tx.create(eventRef, {
      type: 'entity_status_changed',
      schemaVersion: 1,
      payload: { entityId: input.jobId, entityKind: 'Job', version: 1 },
      status: 'PENDING',
      attempts: 0,
      createdAtMs: input.now.getTime(),
      nextAttemptAtMs: input.now.getTime(),
    });
    if (decision.kind === 'REVIEW' && decision.openModerationCase)
      tx.create(caseRef, {
        targetType: 'JOB',
        targetId: input.jobId,
        openedBy: 'AUTO_RISK',
        reportIds: [],
        priority: 'P1',
        v2Status: 'OPEN',
        version: 1,
        assigneeId: null,
        decision: null,
        createdAt: at,
        updatedAt: FieldValue.serverTimestamp(),
      });
    return { kind: 'CREATED', jobId: input.jobId, status };
  });
}
