import {
  buildCandidateTimeline,
  candidateStatusLabel,
} from '@/domain/applications/candidateView';
import type {
  HistoryEntry,
  TimelineItem,
} from '@/domain/applications/candidateView';
import type { ApplicationStatus } from '@/domain/applications/states';

/**
 * E4 — vista do candidato sobre a sua candidatura v2. Allowlist explícita:
 * notas internas, rating, tags, score detalhado, feedback de entrevista e
 * o estado SHORTLISTED nunca saem daqui.
 */
export interface CandidateApplicationView {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  organizationName: string;
  statusLabel: string;
  canWithdraw: boolean;
  timeline: TimelineItem[];
  silenceNotice: string | null;
}

const WITHDRAWABLE: ReadonlySet<string> = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
  'OFFER_DECLINED',
]);

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => unknown }).toDate();
    return date instanceof Date ? date : null;
  }
  return null;
}

export function buildCandidateApplicationView(
  applicationId: string,
  application: Readonly<Record<string, unknown>>,
  history: readonly Readonly<Record<string, unknown>>[],
  now: Date,
): CandidateApplicationView {
  const status = String(application.v2Status) as ApplicationStatus;
  const entries: HistoryEntry[] = [];
  for (const item of history) {
    const at = toDate(item.at);
    if (!at) continue;
    entries.push({
      to: String(item.to) as ApplicationStatus,
      at,
      closedReason:
        typeof item.closedReason === 'string' ? item.closedReason : null,
      candidateVisibleNote:
        typeof item.candidateVisibleNote === 'string'
          ? item.candidateVisibleNote
          : null,
    });
  }
  const { items, silenceNotice } = buildCandidateTimeline(entries, now);
  const jobSnapshot = (application.jobSnapshot ?? {}) as Record<
    string,
    unknown
  >;
  return {
    applicationId,
    jobId: String(application.jobId ?? ''),
    jobTitle: String(
      jobSnapshot.titulo ?? jobSnapshot.title ?? application.jobTitle ?? '',
    ),
    organizationName: String(
      jobSnapshot.companyName ?? application.company ?? '',
    ),
    statusLabel: candidateStatusLabel(
      status,
      typeof application.closedReason === 'string'
        ? application.closedReason
        : null,
    ),
    canWithdraw: WITHDRAWABLE.has(status),
    timeline: items,
    silenceNotice,
  };
}
