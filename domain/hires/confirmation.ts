/**
 * E5 — confirmação dupla da contratação e F3.8 — vagas com várias posições.
 *
 * 30 dias depois do início (ou da confirmação do empregador, sem data) o
 * candidato recebe «Começou a trabalhar na <org>?»; sem resposta em 14 dias
 * fica NO_RESPONSE. DISPUTED abre caso de moderação P3. O sistema só PROPÕE
 * marcar a vaga como preenchida; quem confirma é o empregador.
 */
const DAY_MS = 86_400_000;
export const HIRE_FOLLOW_UP_DAYS = 30;
export const HIRE_RESPONSE_DAYS = 14;

export type CandidateConfirmation =
  'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'NO_RESPONSE';
export const CANDIDATE_ANSWERS = ['CONFIRMED', 'DISPUTED'] as const;
export type CandidateAnswer = (typeof CANDIDATE_ANSWERS)[number];

export type HireFollowUpStage = 'REQUEST' | 'NO_RESPONSE';

export function hireFollowUpStage(
  hire: {
    status: string;
    candidateConfirmation: CandidateConfirmation;
    startDate: Date | null;
    confirmedByEmployerAt: Date;
    confirmationRequestedAt: Date | null;
  },
  now: Date,
): HireFollowUpStage | null {
  if (hire.status !== 'ACTIVE' || hire.candidateConfirmation !== 'PENDING')
    return null;
  if (hire.confirmationRequestedAt)
    return now.getTime() - hire.confirmationRequestedAt.getTime() >=
      HIRE_RESPONSE_DAYS * DAY_MS
      ? 'NO_RESPONSE'
      : null;
  const base = (hire.startDate ?? hire.confirmedByEmployerAt).getTime();
  return now.getTime() - base >= HIRE_FOLLOW_UP_DAYS * DAY_MS
    ? 'REQUEST'
    : null;
}

/** F3.8: «2 de 10 posições preenchidas» e proposta de FILLED quando completa. */
export function positionsSummary(
  vacanciesCount: number,
  activeHires: number,
): {
  label: string;
  proposeFilled: boolean;
} {
  const total =
    Number.isSafeInteger(vacanciesCount) && vacanciesCount >= 1
      ? vacanciesCount
      : 1;
  const filled = Math.max(0, activeHires);
  return {
    label:
      total === 1
        ? filled >= 1
          ? 'Posição preenchida'
          : 'Posição por preencher'
        : `${Math.min(filled, total)} de ${total} posições preenchidas`,
    proposeFilled: filled >= total,
  };
}

/** Data de início opcional (AAAA-MM-DD, até 1 ano). */
export function parseStartDate(
  value: unknown,
  now: Date,
): Date | null | 'INVALID' {
  if (value === undefined || value === null || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return 'INVALID';
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(match[3]))
    return 'INVALID';
  const diff = date.getTime() - now.getTime();
  return diff < -90 * DAY_MS || diff > 365 * DAY_MS ? 'INVALID' : date;
}
