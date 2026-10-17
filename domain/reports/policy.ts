/**
 * E9 — denúncias: prioridade, SLA e ação automática imediata.
 *
 * A ação automática existe só para fraude (pedido de dinheiro, phishing,
 * vaga falsa): ≥ 2 denúncias independentes, ou 1 denúncia com riskScore ≥ 40,
 * ocultam a vaga (→ PENDING_REVIEW) até revisão humana. Assédio e
 * discriminação são P1 mas nunca têm ação automática. O denunciante nunca é
 * revelado ao denunciado.
 */
export const REPORT_REASONS = [
  'ASKED_FOR_MONEY',
  'FAKE_JOB',
  'PHISHING',
  'HARASSMENT',
  'DISCRIMINATION',
  'SPAM',
  'INAPPROPRIATE',
  'DUPLICATE',
  'EXPIRED_STILL_LISTED',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGET_TYPES = [
  'JOB',
  'ORGANIZATION',
  'USER',
  'MESSAGE',
  'APPLICATION',
  'INTERVIEW',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export type ReportPriority = 'P1' | 'P2' | 'P3';

const PRIORITY: Readonly<Record<ReportReason, ReportPriority>> = {
  ASKED_FOR_MONEY: 'P1',
  PHISHING: 'P1',
  FAKE_JOB: 'P1',
  HARASSMENT: 'P1',
  DISCRIMINATION: 'P1',
  SPAM: 'P2',
  DUPLICATE: 'P2',
  INAPPROPRIATE: 'P2',
  EXPIRED_STILL_LISTED: 'P3',
  OTHER: 'P3',
};

/** Motivos que permitem ocultação automática (fraude). */
export const AUTO_HIDE_REASONS: ReadonlySet<ReportReason> = new Set([
  'ASKED_FOR_MONEY',
  'PHISHING',
  'FAKE_JOB',
]);
export const AUTO_HIDE_RISK_THRESHOLD = 40;
export const AUTO_HIDE_INDEPENDENT_REPORTS = 2;
export const MAX_REPORT_DETAILS = 2000;

export function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === 'string' &&
    (REPORT_REASONS as readonly string[]).includes(value)
  );
}
export function isReportTargetType(value: unknown): value is ReportTargetType {
  return (
    typeof value === 'string' &&
    (REPORT_TARGET_TYPES as readonly string[]).includes(value)
  );
}

/** H9: denúncia de entrevista abusiva é sempre P1; da empresa sobre uma
 * candidatura (spam, fraude, abuso) é P2. */
export function reportPriority(
  reason: ReportReason,
  targetType: ReportTargetType,
): ReportPriority {
  if (targetType === 'INTERVIEW') return 'P1';
  if (targetType === 'APPLICATION')
    return PRIORITY[reason] === 'P3' ? 'P3' : 'P2';
  return PRIORITY[reason];
}

const DAY_MS = 86_400_000;

/** SLA: P1 24 h; P2 3 dias úteis; P3 7 dias úteis (fins de semana saltados). */
export function reportDueAt(priority: ReportPriority, createdAt: Date): Date {
  if (priority === 'P1') return new Date(createdAt.getTime() + DAY_MS);
  let remaining = priority === 'P2' ? 3 : 7;
  let t = createdAt.getTime();
  while (remaining > 0) {
    t += DAY_MS;
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining--;
  }
  return new Date(t);
}

/**
 * «Independentes» = denunciantes distintos. O chamador só passa denúncias
 * abertas, de fraude, sobre a mesma vaga; duplicados do mesmo utilizador
 * contam uma vez.
 */
export function shouldAutoHideJob(input: {
  reason: ReportReason;
  reporterIds: readonly string[];
  riskScore: number | null;
}): boolean {
  if (!AUTO_HIDE_REASONS.has(input.reason)) return false;
  const independent = new Set(input.reporterIds.filter(Boolean)).size;
  if (independent >= AUTO_HIDE_INDEPENDENT_REPORTS) return true;
  return (
    independent >= 1 &&
    typeof input.riskScore === 'number' &&
    input.riskScore >= AUTO_HIDE_RISK_THRESHOLD
  );
}

/** Só vagas visíveis podem ser ocultadas pela regra automática (E3). */
export function canAutoHideFrom(jobStatus: string): boolean {
  return jobStatus === 'PUBLISHED' || jobStatus === 'PAUSED';
}

export const REPORT_MESSAGES = Object.freeze({
  RECEIVED:
    'Recebemos a sua denúncia. Obrigado por ajudar a manter o EmpregoSTP seguro.',
  RESOLVED: 'A sua denúncia foi analisada.',
  ALREADY_REPORTED: 'Já denunciou este conteúdo. A equipa está a analisar.',
});
