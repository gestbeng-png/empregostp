import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type {
  NewReport,
  ReportOutcome,
  ReportStore,
} from '@/application/reports/SubmitReport';
import { readJobLifecycle } from '@/domain/jobs/legacyView';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';
import {
  AUTO_HIDE_REASONS,
  canAutoHideFrom,
  shouldAutoHideJob,
} from '@/domain/reports/policy';

import { digest } from '../marketplace/identifiers';

const TARGET_COLLECTIONS: Readonly<Record<string, string>> = {
  JOB: 'jobs',
  ORGANIZATION: 'users',
  USER: 'users',
  APPLICATION: 'applications',
  INTERVIEW: 'interviews',
  MESSAGE: 'messages',
};
const MAX_TRACKED_REPORTERS = 50;

/**
 * Uma transação por denúncia: grava a denúncia (uma por denunciante e alvo),
 * atualiza o agregado do alvo (`reportTargets`, só hashes de denunciantes) e,
 * se a regra E9 disparar, oculta a vaga (PENDING_REVIEW + estado legado),
 * abre/atualiza o ModerationCase, e grava histórico, auditoria e outbox.
 */
export class FirestoreReportStore implements ReportStore {
  constructor(private readonly db: Firestore) {}

  async submit(report: NewReport, now: Date): Promise<ReportOutcome> {
    const collection = TARGET_COLLECTIONS[report.targetType];
    if (!collection) return { kind: 'TARGET_NOT_FOUND' };
    const targetKey = digest([report.targetType, report.targetId]);
    const reportId = digest([
      report.targetType,
      report.targetId,
      report.reporterUserId,
    ]);
    const reporterHash = digest(['reporter', report.reporterUserId]).slice(
      0,
      32,
    );
    const reportRef = this.db.collection('reports').doc(reportId);
    const aggregateRef = this.db.collection('reportTargets').doc(targetKey);
    const targetRef = this.db.collection(collection).doc(report.targetId);
    const internalsRef = this.db
      .collection('jobInternals')
      .doc(report.targetId);
    const historyRef = this.db.collection('jobsStatusHistory').doc();
    const auditRef = this.db.collection('auditLogs').doc();
    const reportEventRef = this.db.collection('outboxEvents').doc();
    const jobEventRef = this.db.collection('outboxEvents').doc();
    const newCaseRef = this.db.collection('moderationCases').doc();
    const at = Timestamp.fromDate(now);
    const isJob = report.targetType === 'JOB';

    return this.db.runTransaction(async (tx): Promise<ReportOutcome> => {
      const [existing, aggregate, target, internals] = await Promise.all([
        tx.get(reportRef),
        tx.get(aggregateRef),
        tx.get(targetRef),
        isJob ? tx.get(internalsRef) : Promise.resolve(null),
      ]);
      if (existing.exists) return { kind: 'ALREADY_REPORTED', reportId };
      const targetData = target.data();
      if (!targetData) return { kind: 'TARGET_NOT_FOUND' };

      const previous = aggregate.data() ?? {};
      const fraudReporters: string[] = Array.isArray(
        previous.fraudReporterHashes,
      )
        ? previous.fraudReporterHashes.filter(
            (v: unknown) => typeof v === 'string',
          )
        : [];
      const isFraud = AUTO_HIDE_REASONS.has(report.reason);
      const reporters = isFraud
        ? [...new Set([...fraudReporters, reporterHash])].slice(
            -MAX_TRACKED_REPORTERS,
          )
        : fraudReporters;
      let caseId: string | null =
        typeof previous.openCaseId === 'string' ? previous.openCaseId : null;
      const needsCase = report.priority === 'P1' || Boolean(caseId);

      let targetHidden = false;
      if (isJob && isFraud) {
        const lifecycle = readJobLifecycle(targetData);
        const riskScore = internals?.data()?.riskScore;
        if (
          canAutoHideFrom(lifecycle.status) &&
          shouldAutoHideJob({
            reason: report.reason,
            reporterIds: reporters,
            riskScore: typeof riskScore === 'number' ? riskScore : null,
          })
        ) {
          const legacy = legacyStatusUpdate('Job', 'PENDING_REVIEW');
          const version = lifecycle.version + 1;
          // D7: `v2Status` só é escrito em vagas que já o têm (expand feito
          // pelo backfill). Numa vaga legada, a moderação atual — que só
          // conhece `status` — tem de continuar a ser a fonte de verdade.
          const hasLifecycleStatus = typeof targetData.v2Status === 'string';
          tx.update(targetRef, {
            ...(legacy.ok ? legacy.value : {}),
            ...(hasLifecycleStatus
              ? { v2Status: 'PENDING_REVIEW', version }
              : {}),
            destaque: false,
            autoHiddenAt: at,
            autoHiddenReason: 'REPORTS_FRAUD',
            updatedAt: at,
            updatedBy: 'system:reportAutoHide',
          });
          tx.create(historyRef, {
            entityId: report.targetId,
            from: lifecycle.status,
            to: 'PENDING_REVIEW',
            actorId: 'system:reportAutoHide',
            actorType: 'SYSTEM',
            reason: 'REPORTS_FRAUD',
            at,
            version,
          });
          tx.create(jobEventRef, {
            type: 'entity_status_changed',
            schemaVersion: 1,
            payload: { entityId: report.targetId, entityKind: 'Job', version },
            status: 'PENDING',
            attempts: 0,
            createdAtMs: now.getTime(),
            nextAttemptAtMs: now.getTime(),
          });
          tx.create(auditRef, {
            actorId: 'system:reportAutoHide',
            actorType: 'SYSTEM',
            action: 'job_auto_hidden',
            resourceType: 'Job',
            resourceId: report.targetId,
            ...(lifecycle.organizationId
              ? { organizationId: lifecycle.organizationId }
              : {}),
            metadata: {
              from: lifecycle.status,
              to: 'PENDING_REVIEW',
              reports: reporters.length,
            },
            at,
          });
          targetHidden = true;
        }
      }

      if (needsCase || targetHidden) {
        if (caseId) {
          tx.update(this.db.collection('moderationCases').doc(caseId), {
            reportIds: FieldValue.arrayUnion(reportId),
            ...(targetHidden ? { targetHiddenAt: at } : {}),
            updatedAt: at,
          });
        } else {
          caseId = newCaseRef.id;
          tx.create(newCaseRef, {
            targetType: report.targetType,
            targetId: report.targetId,
            openedBy: targetHidden ? 'AUTO_RISK' : 'REPORT',
            reportIds: [reportId],
            priority: report.priority,
            v2Status: 'OPEN',
            version: 1,
            assigneeId: null,
            decision: null,
            ...(targetHidden ? { targetHiddenAt: at } : {}),
            createdAt: at,
            updatedAt: at,
          });
        }
      }

      tx.create(reportRef, {
        reporterUserId: report.reporterUserId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        details: report.details,
        evidenceKeys: [],
        priority: report.priority,
        v2Status: 'OPEN',
        version: 1,
        caseId,
        dueAt: Timestamp.fromDate(report.dueAt),
        createdAt: at,
        updatedAt: at,
      });
      tx.set(
        aggregateRef,
        {
          targetType: report.targetType,
          targetId: report.targetId,
          fraudReporterHashes: reporters,
          reportCount: (Number(previous.reportCount) || 0) + 1,
          openCaseId: caseId,
          lastReportAt: at,
        },
        { merge: true },
      );
      tx.create(reportEventRef, {
        type: 'entity_status_changed',
        schemaVersion: 1,
        payload: { entityId: reportId, entityKind: 'Report', version: 1 },
        status: 'PENDING',
        attempts: 0,
        createdAtMs: now.getTime(),
        nextAttemptAtMs: now.getTime(),
      });
      return { kind: 'CREATED', reportId, targetHidden };
    });
  }
}
