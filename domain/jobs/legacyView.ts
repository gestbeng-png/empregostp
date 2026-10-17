/**
 * Leitura de vagas durante a migração (D7: «lê do novo com fallback ao
 * antigo»). `v2Status` ganha sempre; sem ele, o estado legado é traduzido.
 * O prazo legado `dataFecho` (AAAA-MM-DD) é o fim do dia em STP (B4).
 */
import { deadlineToUtc } from './deadlines';
import type { JobStatus } from './states';

const FROM_LEGACY: Readonly<Record<string, JobStatus>> = {
  active: 'PUBLISHED',
  open: 'PUBLISHED',
  aberta: 'PUBLISHED',
  published: 'PUBLISHED',
  pending_review: 'PENDING_REVIEW',
  draft: 'DRAFT',
  inactive: 'PAUSED',
  closed: 'CLOSED',
  rejected: 'REJECTED',
  // Desativada pela administração: nunca aceita candidaturas.
  disabled: 'REJECTED',
};
const V2_STATUSES = new Set<string>(
  Object.values(FROM_LEGACY).concat(['FILLED', 'EXPIRED', 'ARCHIVED']),
);

function toDate(value: unknown): Date | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => unknown }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value === 'number' && Number.isFinite(value))
    return new Date(value);
  if (typeof value === 'string' && value) {
    const dateOnly = deadlineToUtc(value);
    if (dateOnly) return dateOnly;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export interface JobLifecycleView {
  status: JobStatus;
  applicationMethod: 'INTERNAL' | 'EXTERNAL_URL' | 'EXTERNAL_EMAIL';
  applicationDeadline: Date | null;
  expiresAt: Date | null;
  organizationId: string | null;
  version: number;
}

/** Alias semântico para o planeador de expand. */
export function legacyStatusFromJob(
  job: Readonly<Record<string, unknown>>,
): JobLifecycleView {
  return readJobLifecycle(job);
}

export function readJobLifecycle(
  job: Readonly<Record<string, unknown>>,
): JobLifecycleView {
  const v2 = typeof job.v2Status === 'string' ? job.v2Status : '';
  const legacy =
    String(job.status ?? 'active')
      .trim()
      .toLowerCase() || 'active';
  const status = (V2_STATUSES.has(v2) ? v2 : FROM_LEGACY[legacy]) ?? 'DRAFT';
  const method = job.applicationMethod;
  return {
    status: status as JobStatus,
    applicationMethod:
      method === 'EXTERNAL_URL' || method === 'EXTERNAL_EMAIL'
        ? method
        : 'INTERNAL',
    applicationDeadline:
      toDate(job.applicationDeadline) ?? toDate(job.dataFecho),
    expiresAt: toDate(job.expiresAt),
    organizationId:
      typeof job.organizationId === 'string' && job.organizationId
        ? job.organizationId
        : typeof job.companyId === 'string' && job.companyId
          ? job.companyId
          : null,
    version: Number.isSafeInteger(job.version) ? (job.version as number) : 0,
  };
}
