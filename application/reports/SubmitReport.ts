import { can } from '@/domain/permissions/can';
import type { PermissionRole } from '@/domain/permissions/can';
import {
  isReportReason,
  isReportTargetType,
  MAX_REPORT_DETAILS,
  reportDueAt,
  reportPriority,
} from '@/domain/reports/policy';
import type {
  ReportPriority,
  ReportReason,
  ReportTargetType,
} from '@/domain/reports/policy';

/**
 * E9/F1.8 — «Pediram-me dinheiro» e denúncias em geral. Exige sessão: a independência das denúncias (regra de
 * ocultação automática) só se mede com identidades distintas (ADR-011).
 */
export interface SubmitReportCommand {
  reporterUserId: string;
  /** Resolvido no servidor a partir da conta, nunca do pedido. */
  reporterRole: PermissionRole;
  targetType: unknown;
  targetId: unknown;
  reason: unknown;
  details: unknown;
}
export interface NewReport {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
  priority: ReportPriority;
  dueAt: Date;
}
export type ReportOutcome =
  | { kind: 'CREATED'; reportId: string; targetHidden: boolean }
  | { kind: 'ALREADY_REPORTED'; reportId: string }
  | { kind: 'TARGET_NOT_FOUND' };
export interface ReportStore {
  submit(report: NewReport, now: Date): Promise<ReportOutcome>;
}
export type ReportRateLimiter = (userId: string) => Promise<boolean>;

export type SubmitReportResult =
  | { ok: true; reportId: string; alreadyReported: boolean }
  | {
      ok: false;
      code:
        | 'FEATURE_DISABLED'
        | 'FORBIDDEN'
        | 'INVALID_INPUT'
        | 'NOT_FOUND'
        | 'RATE_LIMITED';
    };

const TARGET_ID = /^[A-Za-z0-9_-]{1,200}$/;

export class SubmitReport {
  constructor(
    private readonly store: ReportStore,
    private readonly rateLimit: ReportRateLimiter,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: SubmitReportCommand): Promise<SubmitReportResult> {
    // D14/H3: a equipa da plataforma decide denúncias, não as abre.
    if (
      !can(
        {
          userId: command.reporterUserId,
          role: command.reporterRole,
          active: true,
        },
        'report',
      )
    )
      return { ok: false, code: 'FORBIDDEN' };
    const { targetType, targetId, reason } = command;
    if (
      !isReportTargetType(targetType) ||
      typeof targetId !== 'string' ||
      !TARGET_ID.test(targetId) ||
      !isReportReason(reason) ||
      (command.details !== undefined &&
        command.details !== null &&
        typeof command.details !== 'string')
    )
      return { ok: false, code: 'INVALID_INPUT' };
    if (!(await this.rateLimit(command.reporterUserId)))
      return { ok: false, code: 'RATE_LIMITED' };
    const now = this.clock();
    const priority = reportPriority(reason, targetType);
    const outcome = await this.store.submit(
      {
        reporterUserId: command.reporterUserId,
        targetType,
        targetId,
        reason,
        details: String(command.details ?? '')
          .trim()
          .slice(0, MAX_REPORT_DETAILS),
        priority,
        dueAt: reportDueAt(priority, now),
      },
      now,
    );
    if (outcome.kind === 'TARGET_NOT_FOUND')
      return { ok: false, code: 'NOT_FOUND' };
    return {
      ok: true,
      reportId: outcome.reportId,
      alreadyReported: outcome.kind === 'ALREADY_REPORTED',
    };
  }
}
