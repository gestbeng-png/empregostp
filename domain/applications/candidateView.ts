/**
 * E4 — o que o candidato vê. A pré-seleção (SHORTLISTED) é um estado interno
 * de triagem e nunca é exposta; notas internas, rating, tags, feedback de
 * entrevista e score da empresa também não entram aqui.
 */
import { formatStpDate } from '../jobs/deadlines';

import type { ApplicationStatus } from './states';

export const CLOSED_REASONS = [
  'NOT_SELECTED',
  'HARD_REQUIREMENT_NOT_MET',
  'KNOCKOUT_ANSWER',
  'POSITION_FILLED',
  'POSITION_CLOSED',
  'POSITION_CANCELLED',
  'DUPLICATE',
  'SPAM',
  'HIRE_ANNULLED',
  'OTHER',
] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number];

const POSITION_ENDED = new Set<string>([
  'POSITION_FILLED',
  'POSITION_CLOSED',
  'POSITION_CANCELLED',
]);

/**
 * Como terminou uma proposta que não foi recusada pelo candidato. Ficam em
 * `closedReason` da candidatura em OFFER_DECLINED (o estado que o domínio usa
 * para «proposta recusada ou expirada»); não são motivos de não seleção.
 */
export const OFFER_ENDED_REASONS = [
  'OFFER_WITHDRAWN',
  'OFFER_EXPIRED',
] as const;
export type OfferEndedReason = (typeof OFFER_ENDED_REASONS)[number];
const OFFER_ENDED_LABELS: Readonly<Record<OfferEndedReason, string>> = {
  OFFER_WITHDRAWN: 'Proposta retirada',
  OFFER_EXPIRED: 'Proposta expirada',
};

const LABELS: Readonly<Record<ApplicationStatus, string>> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Recebida',
  UNDER_REVIEW: 'Em análise',
  SHORTLISTED: 'Em análise',
  INTERVIEW: 'Entrevista',
  OFFER: 'Proposta recebida',
  HIRED: 'Contratado(a)',
  REJECTED: 'Não selecionada',
  WITHDRAWN: 'Retirada',
  OFFER_DECLINED: 'Proposta recusada',
};

export function candidateStatusLabel(
  status: ApplicationStatus,
  closedReason?: string | null,
): string {
  if (status === 'REJECTED' && closedReason && POSITION_ENDED.has(closedReason))
    return 'Processo encerrado';
  if (
    status === 'OFFER_DECLINED' &&
    closedReason &&
    Object.hasOwn(OFFER_ENDED_LABELS, closedReason)
  )
    return OFFER_ENDED_LABELS[closedReason as OfferEndedReason];
  return LABELS[status] ?? 'Em análise';
}

export interface HistoryEntry {
  to: ApplicationStatus;
  at: Date;
  closedReason?: string | null;
  candidateVisibleNote?: string | null;
}
export interface TimelineItem {
  label: string;
  date: string;
  note: string | null;
}

export const SILENCE_NOTICE_DAYS = 21;
const DAY_MS = 86_400_000;
const OPEN: ReadonlySet<ApplicationStatus> = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
]);

/**
 * Linha temporal do candidato: uma entrada por mudança visível (duas
 * mudanças internas seguidas com o mesmo rótulo — ex.: UNDER_REVIEW →
 * SHORTLISTED — aparecem uma só vez) e o aviso de silêncio de F2.8.
 */
export function buildCandidateTimeline(
  history: readonly HistoryEntry[],
  now: Date,
): { items: TimelineItem[]; silenceNotice: string | null } {
  const sorted = [...history].sort((a, b) => a.at.getTime() - b.at.getTime());
  const items: TimelineItem[] = [];
  for (const entry of sorted) {
    const label = candidateStatusLabel(entry.to, entry.closedReason);
    const note = entry.candidateVisibleNote?.trim() || null;
    const previous = items[items.length - 1];
    if (previous && previous.label === label && !note) continue;
    items.push({ label, date: formatStpDate(entry.at), note });
  }
  const last = sorted[sorted.length - 1];
  const silent =
    last &&
    OPEN.has(last.to) &&
    now.getTime() - last.at.getTime() >= SILENCE_NOTICE_DAYS * DAY_MS;
  return {
    items,
    silenceNotice: silent
      ? `Sem atualização desde ${formatStpDate(last.at)} — a empresa ainda está a analisar.`
      : null,
  };
}
