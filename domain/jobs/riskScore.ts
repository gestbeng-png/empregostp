import { normalizePlace as normalize } from '../geo/districts';

import type { VerificationLevel } from './qualityScore';

/**
 * F1.6 — moderação automática (riskScore 0–100).
 *
 * ≥ 40 → PENDING_REVIEW; ≥ 70 → PENDING_REVIEW + ModerationCase P1. Os
 * sinais vão para o moderador e **nunca** para o empregador em detalhe
 * (`riskSignals` é campo interno — `domain/jobs/internalFields.ts`).
 * Regra absoluta: nenhuma vaga legítima exige pagamento do candidato.
 */

/** Lista configurável PT/FR/EN, já sem acentos (comparação normalizada). */
export const DEFAULT_MONEY_TERMS: readonly string[] = [
  'taxa de inscricao',
  'pagar',
  'deposito',
  'transferencia',
  'caucao',
  'custo do processo',
  'taxa de formacao obrigatoria',
  'western union',
  'moneygram',
  'comprar uniforme',
  'frais d inscription',
  'frais de dossier',
  'payer',
  'virement',
  'registration fee',
  'processing fee',
  'pay a fee',
  'wire transfer',
];
const IDENTITY_OR_BANK_TERMS = [
  'bilhete de identidade',
  'copia do bi',
  'passaporte',
  'nib',
  'iban',
  'dados bancarios',
  'numero de conta',
  'cartao bancario',
  'cartao multibanco',
];
const ABROAD_TERMS = [
  'visto',
  'emprego no estrangeiro',
  'trabalhar no estrangeiro',
  'trabalho em portugal',
  'trabalho na europa',
  'emigrar',
];
const URL_SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
  'tiny.cc',
];
const FREE_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.pt',
  'outlook.com',
  'outlook.pt',
  'live.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'aol.com',
];

export type RiskSignal =
  | 'ASKS_FOR_MONEY'
  | 'IDENTITY_OR_BANK_DOCUMENTS'
  | 'PERSONAL_CONTACT_ONLY'
  | 'FREE_EMAIL_UNVERIFIED_ORG'
  | 'SHORT_OR_BLOCKED_LINK'
  | 'SALARY_OUT_OF_RANGE'
  | 'NEW_ORGANIZATION'
  | 'DUPLICATE_CONTENT'
  | 'ABROAD_WITH_COSTS'
  | 'ORGANIZATION_VERIFIED'
  | 'TRUSTED_PARTNER';

const POINTS: Readonly<Record<RiskSignal, number>> = {
  ASKS_FOR_MONEY: 60,
  IDENTITY_OR_BANK_DOCUMENTS: 30,
  PERSONAL_CONTACT_ONLY: 15,
  FREE_EMAIL_UNVERIFIED_ORG: 10,
  SHORT_OR_BLOCKED_LINK: 25,
  SALARY_OUT_OF_RANGE: 15,
  NEW_ORGANIZATION: 10,
  DUPLICATE_CONTENT: 20,
  ABROAD_WITH_COSTS: 40,
  ORGANIZATION_VERIFIED: -20,
  TRUSTED_PARTNER: -30,
};

export interface RiskInput {
  /** Título, descrição, requisitos e instruções de candidatura. */
  text: string;
  applicationMethod: 'INTERNAL' | 'EXTERNAL_URL' | 'EXTERNAL_EMAIL';
  contactEmail?: string | null;
  mentionsPersonalPhoneOrWhatsapp: boolean;
  links: readonly string[];
  salaryOutsideSanity: boolean;
  organizationVerification: VerificationLevel;
  organizationCreatedAt: Date;
  now: Date;
  /** Maior semelhança (0–1) com vagas de outras organizações. */
  duplicateSimilarity: number;
  moneyTerms?: readonly string[];
  blockedDomains?: readonly string[];
}

function containsTerm(text: string, terms: readonly string[]): boolean {
  const haystack = ` ${normalize(text)} `;
  return terms.some((term) => haystack.includes(` ${normalize(term)} `));
}

function hostOf(link: string): string {
  try {
    return new URL(
      /^https?:\/\//i.test(link) ? link : `https://${link}`,
    ).hostname
      .toLowerCase()
      .replace(/^www\./, '');
  } catch {
    return '';
  }
}

export interface RiskResult {
  score: number;
  signals: RiskSignal[];
  requiresReview: boolean;
  openP1Case: boolean;
}

export function computeRiskScore(input: RiskInput): RiskResult {
  const signals: RiskSignal[] = [];
  const asksMoney = containsTerm(
    input.text,
    input.moneyTerms ?? DEFAULT_MONEY_TERMS,
  );
  if (asksMoney) signals.push('ASKS_FOR_MONEY');
  if (containsTerm(input.text, IDENTITY_OR_BANK_TERMS))
    signals.push('IDENTITY_OR_BANK_DOCUMENTS');

  const emailDomain = String(input.contactEmail ?? '')
    .split('@')[1]
    ?.toLowerCase()
    .trim();
  const freeEmail = Boolean(
    emailDomain && FREE_EMAIL_DOMAINS.includes(emailDomain),
  );
  const corporateEmail = Boolean(emailDomain && !freeEmail);
  if (
    input.mentionsPersonalPhoneOrWhatsapp &&
    input.applicationMethod !== 'INTERNAL' &&
    !corporateEmail
  )
    signals.push('PERSONAL_CONTACT_ONLY');
  const unverified =
    input.organizationVerification === 'REGISTERED' ||
    input.organizationVerification === undefined;
  if (freeEmail && unverified) signals.push('FREE_EMAIL_UNVERIFIED_ORG');

  const blocked = new Set([...URL_SHORTENERS, ...(input.blockedDomains ?? [])]);
  if (input.links.some((link) => blocked.has(hostOf(link))))
    signals.push('SHORT_OR_BLOCKED_LINK');
  if (input.salaryOutsideSanity) signals.push('SALARY_OUT_OF_RANGE');
  if (
    input.now.getTime() - input.organizationCreatedAt.getTime() <
    48 * 3_600_000
  )
    signals.push('NEW_ORGANIZATION');
  if (input.duplicateSimilarity >= 0.9) signals.push('DUPLICATE_CONTENT');
  if (asksMoney && containsTerm(input.text, ABROAD_TERMS))
    signals.push('ABROAD_WITH_COSTS');
  if (input.organizationVerification === 'ORGANIZATION_VERIFIED')
    signals.push('ORGANIZATION_VERIFIED');
  if (input.organizationVerification === 'TRUSTED_PARTNER')
    signals.push('TRUSTED_PARTNER');

  const raw = signals.reduce((sum, signal) => sum + POINTS[signal], 0);
  const score = Math.max(0, Math.min(100, raw));
  return {
    score,
    signals,
    requiresReview: score >= 40,
    openP1Case: score >= 70,
  };
}

/** Mensagem única ao empregador: nunca revela os sinais (F1.6). */
export const EMPLOYER_REVIEW_MESSAGE =
  'A sua vaga está em revisão. Normalmente demora até 1 dia útil.';
