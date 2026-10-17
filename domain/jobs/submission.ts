/**
 * F1 — avaliação de uma vaga submetida pelo formulário atual: expand (D7),
 * multi-função (F1.1), qualidade (F1.2), risco (F1.6), duplicado (F1.13) e
 * decisão E3. Puro: o servidor fornece os factos (verificação, histórico,
 * vagas existentes) e grava o resultado.
 */
import { isSalaryOutsideSanity } from '../money/money';
import type { SalaryType } from '../money/money';

import { planJobExpand } from './expand';
import type { JobReviewCode } from './expand';
import { legacyStatusFromJob } from './legacyView';
import { detectMultipleRoles } from './multiRole';
import { decidePublication, findAccidentalDuplicate } from './publication';
import type { PublicationDecision } from './publication';
import { computeQualityScore } from './qualityScore';
import type { QualityResult, VerificationLevel } from './qualityScore';
import { computeRiskScore } from './riskScore';
import type { RiskResult } from './riskScore';
import { detectProtectedTerms } from './screening';

type Plain = Readonly<Record<string, unknown>>;

const PHONE_OR_WHATSAPP =
  /whats\s*app|\bzap\b|(?:\+?239[\s.-]?)?\b9\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/i;
const URL = /\bhttps?:\/\/[^\s<>"')]+|\bwww\.[^\s<>"')]+/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function lines(value: unknown): string[] {
  return String(value ?? '')
    .split(/\r?\n|;|•/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 3);
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? '')
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Nível v2 da organização a partir dos campos legados da conta de empresa.
 * O email verificado no Firebase não chega para CONTACT_VERIFIED (E8 exige
 * domínio próprio ou telemóvel por OTP). */
export function organizationVerificationOf(company: Plain): VerificationLevel {
  const level = company.verificationLevel;
  if (
    level === 'CONTACT_VERIFIED' ||
    level === 'ORGANIZATION_VERIFIED' ||
    level === 'TRUSTED_PARTNER'
  )
    return level;
  const legacy = String(company.verificationStatus ?? '').toLowerCase();
  return legacy === 'verified' || legacy === 'approved'
    ? 'ORGANIZATION_VERIFIED'
    : 'REGISTERED';
}

export interface JobSubmissionEvaluation {
  decision: PublicationDecision;
  /** H8: mostrados ao empregador como aviso no editor. */
  protectedTerms: string[];
  quality: QualityResult;
  risk: RiskResult;
  expand: { fields: Record<string, unknown>; review: JobReviewCode[] };
}

export function evaluateJobSubmission(input: {
  payload: Plain;
  company: Plain;
  companyCreatedAt: Date | null;
  existingJobs: readonly Plain[];
  platformModerationForced: boolean;
  now: Date;
}): JobSubmissionEvaluation {
  const { payload, now } = input;
  const expand = planJobExpand(payload);
  const f = expand.fields;
  const title = String(payload.titulo ?? '');
  const verification = organizationVerificationOf(input.company);
  const quality = computeQualityScore({
    title,
    description: String(payload.descricao ?? ''),
    responsibilities: lines(payload.responsabilidades),
    requirements: lines(payload.requisitos),
    skills: list(payload.palavrasChave),
    salaryType: f.salaryType as SalaryType,
    district: (f.district as string | null) ?? null,
    workMode: (f.workMode as string | null) ?? null,
    employmentType: (f.employmentType as string | null) ?? null,
    applicationDeadline: (f.applicationDeadline as Date | null) ?? null,
    organizationVerification: verification,
  });
  const text = [
    payload.titulo,
    payload.descricao,
    payload.requisitos,
    payload.responsabilidades,
    payload.beneficios,
  ]
    .map((part) => String(part ?? ''))
    .join('\n');
  const minMinor = f.salaryMinMinor as number | null;
  const maxMinor = f.salaryMaxMinor as number | null;
  const risk = computeRiskScore({
    text,
    applicationMethod: 'INTERNAL',
    contactEmail: EMAIL.exec(text)?.[0] ?? null,
    mentionsPersonalPhoneOrWhatsapp: PHONE_OR_WHATSAPP.test(text),
    links: text.match(URL) ?? [],
    // Só para o sinal de risco: o formulário antigo não tem período e os
    // salários em STP são mensais na prática. Nunca é gravado como período.
    salaryOutsideSanity: isSalaryOutsideSanity({
      type: f.salaryType as SalaryType,
      minMinor,
      maxMinor,
      currency: 'STN',
      period: 'MONTH',
    }),
    organizationVerification: verification,
    organizationCreatedAt: input.companyCreatedAt ?? new Date(0),
    now,
    // Semelhança entre organizações ainda não calculada (Fase 4).
    duplicateSimilarity: 0,
  });
  const existing = input.existingJobs.map((job) => {
    const view = legacyStatusFromJob(job);
    const created = job.createdAt as { toDate?: () => Date } | Date | undefined;
    return {
      id: String(job.id ?? ''),
      title: String(job.titulo ?? job.title ?? ''),
      district:
        (job.district as string | null | undefined) ??
        (planJobExpand(job).fields.district as string | null),
      status: view.status,
      createdAt:
        created instanceof Date
          ? created
          : typeof created?.toDate === 'function'
            ? created.toDate()
            : null,
    };
  });
  const hasApproved = input.existingJobs.some(
    (job) =>
      Boolean(job.publishedAt) ||
      ['active', 'closed', 'inactive'].includes(
        String(job.status ?? '').toLowerCase(),
      ),
  );
  const protectedTerms = detectProtectedTerms(text);
  const decision = decidePublication({
    multiRole: detectMultipleRoles(title),
    quality,
    risk,
    organizationVerification: verification,
    organizationHasApprovedJob: hasApproved,
    duplicateOfJobId: findAccidentalDuplicate(
      { title, district: (f.district as string | null) ?? null },
      existing,
      now,
    ),
    platformModerationForced: input.platformModerationForced,
    protectedTerms,
  });
  return { decision, quality, risk, expand, protectedTerms };
}
