/**
 * F2.8 — combate ao silêncio («buraco negro»).
 *
 * Nenhuma candidatura fica aberta indefinidamente: quando a vaga fecha,
 * expira ou é preenchida, as candidaturas abertas passam a REJECTED com o
 * motivo do fecho. O empregador tem 7 dias para personalizar a mensagem; a
 * partir daí segue o template F3.6. Do lado do empregador, lembretes em dias
 * úteis D+5 e D+10 e uma flag interna D+15, sem penalização automática.
 */
import type { ClosedReason } from './candidateView';
import type { ApplicationStatus } from './states';

const DAY_MS = 86_400_000;
export const JOB_END_GRACE_DAYS = 7;

export type JobEndState = 'CLOSED' | 'FILLED' | 'EXPIRED';
export type CloseOutcome =
  | 'HIRED_VIA_EMPREGOSTP'
  | 'HIRED_OTHER_CHANNEL'
  | 'NO_SUITABLE_CANDIDATE'
  | 'POSITION_CANCELLED'
  | 'POSITION_ON_HOLD'
  | 'OTHER';

export const CLOSE_OUTCOMES: readonly CloseOutcome[] = [
  'HIRED_VIA_EMPREGOSTP',
  'HIRED_OTHER_CHANNEL',
  'NO_SUITABLE_CANDIDATE',
  'POSITION_CANCELLED',
  'POSITION_ON_HOLD',
  'OTHER',
];

const OPEN_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
]);

/** OFFER fica de fora: a proposta tem prazo próprio (E7) e decide-se por ela. */
export function isOpenForJobEnd(status: ApplicationStatus): boolean {
  return OPEN_STATUSES.has(status);
}

export function closedReasonForJobEnd(
  state: JobEndState,
  outcome: CloseOutcome | null,
): Extract<
  ClosedReason,
  'POSITION_FILLED' | 'POSITION_CLOSED' | 'POSITION_CANCELLED'
> {
  if (state === 'FILLED') return 'POSITION_FILLED';
  if (outcome === 'HIRED_VIA_EMPREGOSTP' || outcome === 'HIRED_OTHER_CHANNEL')
    return 'POSITION_FILLED';
  if (outcome === 'POSITION_CANCELLED') return 'POSITION_CANCELLED';
  return 'POSITION_CLOSED';
}

export interface JobEndPlan {
  due: { applicationId: string; closedReason: ClosedReason }[];
  waitingForEmployer: string[];
  dueAt: Date;
}

/**
 * Decide que candidaturas abertas fecham agora. Antes de `endedAt + 7 dias`
 * só fecham se o empregador já confirmou a mensagem (personalizada ou não).
 */
export function planJobEndClosures(input: {
  state: JobEndState;
  outcome: CloseOutcome | null;
  endedAt: Date;
  now: Date;
  employerMessageConfirmed: boolean;
  applications: readonly { id: string; status: ApplicationStatus }[];
}): JobEndPlan {
  const dueAt = new Date(input.endedAt.getTime() + JOB_END_GRACE_DAYS * DAY_MS);
  const open = input.applications.filter((item) =>
    isOpenForJobEnd(item.status),
  );
  const closedReason = closedReasonForJobEnd(input.state, input.outcome);
  if (input.employerMessageConfirmed || input.now.getTime() >= dueAt.getTime())
    return {
      due: open.map((item) => ({ applicationId: item.id, closedReason })),
      waitingForEmployer: [],
      dueAt,
    };
  return { due: [], waitingForEmployer: open.map((item) => item.id), dueAt };
}

/** Dias úteis completos entre duas datas (seg–sex, fuso STP = UTC). */
export function businessDaysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  let days = 0;
  for (let t = start + DAY_MS; t <= end; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return days;
}

export type SilenceStage = 'REMINDER_D5' | 'REMINDER_D10' | 'STAFF_FLAG_D15';

/** Etapa mais avançada atingida desde a candidatura mais antiga por analisar. */
export function employerSilenceStage(
  oldestSubmittedAt: Date | null,
  now: Date,
): SilenceStage | null {
  if (!oldestSubmittedAt) return null;
  const days = businessDaysBetween(oldestSubmittedAt, now);
  if (days >= 15) return 'STAFF_FLAG_D15';
  if (days >= 10) return 'REMINDER_D10';
  if (days >= 5) return 'REMINDER_D5';
  return null;
}

/** F3.6 — templates por defeito (o empregador pode editar). */
export const DEFAULT_REJECTION_TEMPLATES = Object.freeze({
  NOT_SELECTED:
    'Olá {nome}, obrigado pelo interesse na vaga de {vaga} na {organizacao}. Após análise, decidimos avançar com outros perfis neste processo. Encorajamos a continuar a acompanhar as nossas oportunidades no EmpregoSTP. Desejamos-lhe sucesso.',
  PROCESS_CLOSED:
    'Olá {nome}, o processo de recrutamento para {vaga} foi encerrado. Obrigado pela sua candidatura. Continue a acompanhar novas oportunidades — pode criar um alerta para vagas semelhantes.',
});

/** Substitui só as três variáveis permitidas; o resto do texto fica igual. */
export function renderCandidateTemplate(
  template: string,
  vars: { nome: string; vaga: string; organizacao: string },
): string {
  return template.replace(/\{(nome|vaga|organizacao)\}/g, (_, key: string) =>
    String(vars[key as keyof typeof vars] ?? '').trim(),
  );
}
