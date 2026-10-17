/**
 * E3 — decisão ao submeter uma vaga (DRAFT → PUBLISHED | PENDING_REVIEW).
 *
 * Bloqueios (a vaga não é gravada como submetida): várias funções no título
 * (F1.1), qualidade < 50 (F1.2) e publicação duplicada acidental (F1.13).
 * Revisão humana: risco ≥ 40 (F1.6), organização abaixo de CONTACT_VERIFIED,
 * primeira vaga da organização, título com dúvida de multi-função, ou
 * moderação forçada pela plataforma. Risco ≥ 70 abre ModerationCase P1.
 * Nada aqui depende de pagamento.
 */
import { normalizePlace } from '../geo/districts';

import type { MultiRoleResult } from './multiRole';
import type { QualityResult, VerificationLevel } from './qualityScore';
import type { RiskResult } from './riskScore';

export const MULTI_ROLE_MESSAGE =
  'Cada anúncio deve corresponder a uma única função. Crie uma vaga para cada função.';
export const DUPLICATE_JOB_MESSAGE =
  'Já tem uma vaga igual publicada. Quer prorrogá-la ou aumentar o número de posições?';
export const QUALITY_BLOCK_MESSAGE =
  'Complete a vaga antes de publicar. Falta:';

export type ReviewReason =
  | 'RISK'
  | 'ORGANIZATION_NOT_VERIFIED'
  | 'FIRST_JOB'
  | 'TITLE_REVIEW'
  | 'PROTECTED_TERMS'
  | 'PLATFORM_MODERATION';

export type PublicationDecision =
  | {
      kind: 'BLOCKED';
      code: 'JOB_MULTIPLE_ROLES';
      message: string;
      splitTitles: string[];
    }
  | {
      kind: 'BLOCKED';
      code: 'JOB_QUALITY_TOO_LOW';
      message: string;
      missing: QualityResult['missing'];
    }
  | {
      kind: 'BLOCKED';
      code: 'JOB_DUPLICATE';
      message: string;
      duplicateOfJobId: string;
    }
  | { kind: 'PUBLISH' }
  | { kind: 'REVIEW'; reasons: ReviewReason[]; openModerationCase: boolean };

const VERIFIED: ReadonlySet<VerificationLevel> = new Set([
  'CONTACT_VERIFIED',
  'ORGANIZATION_VERIFIED',
  'TRUSTED_PARTNER',
]);

export function decidePublication(input: {
  multiRole: MultiRoleResult;
  quality: QualityResult;
  risk: RiskResult;
  organizationVerification: VerificationLevel;
  organizationHasApprovedJob: boolean;
  duplicateOfJobId: string | null;
  platformModerationForced: boolean;
  /** H8: termos sobre atributos protegidos no texto (revisão humana). */
  protectedTerms?: readonly string[];
}): PublicationDecision {
  if (input.multiRole.verdict === 'MULTIPLE')
    return {
      kind: 'BLOCKED',
      code: 'JOB_MULTIPLE_ROLES',
      message: MULTI_ROLE_MESSAGE,
      splitTitles: input.multiRole.parts,
    };
  if (input.duplicateOfJobId)
    return {
      kind: 'BLOCKED',
      code: 'JOB_DUPLICATE',
      message: DUPLICATE_JOB_MESSAGE,
      duplicateOfJobId: input.duplicateOfJobId,
    };
  if (input.quality.score < 50)
    return {
      kind: 'BLOCKED',
      code: 'JOB_QUALITY_TOO_LOW',
      message: QUALITY_BLOCK_MESSAGE,
      missing: input.quality.missing,
    };
  const reasons: ReviewReason[] = [];
  if (input.risk.score >= 40) reasons.push('RISK');
  if (!VERIFIED.has(input.organizationVerification))
    reasons.push('ORGANIZATION_NOT_VERIFIED');
  if (!input.organizationHasApprovedJob) reasons.push('FIRST_JOB');
  if (input.multiRole.verdict === 'REVIEW') reasons.push('TITLE_REVIEW');
  if (input.protectedTerms?.length) reasons.push('PROTECTED_TERMS');
  if (input.platformModerationForced) reasons.push('PLATFORM_MODERATION');
  if (!reasons.length) return { kind: 'PUBLISH' };
  return {
    kind: 'REVIEW',
    reasons,
    openModerationCase: input.risk.score >= 70,
  };
}

/** Título normalizado para comparação (minúsculas, sem acentos nem pontuação). */
export function normalizeJobTitle(title: string): string {
  return normalizePlace(title)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const THIRTY_DAYS_MS = 30 * 86_400_000;

/**
 * F1.13 — mesma organização + título normalizado + distrito + estado
 * PUBLISHED/PENDING_REVIEW, criada nos últimos 30 dias.
 */
export function findAccidentalDuplicate(
  candidate: { title: string; district: string | null },
  existing: readonly {
    id: string;
    title: string;
    district: string | null;
    status: string;
    createdAt: Date | null;
  }[],
  now: Date,
): string | null {
  const title = normalizeJobTitle(candidate.title);
  if (!title) return null;
  const match = existing.find(
    (job) =>
      (job.status === 'PUBLISHED' || job.status === 'PENDING_REVIEW') &&
      normalizeJobTitle(job.title) === title &&
      (job.district ?? null) === (candidate.district ?? null) &&
      job.createdAt !== null &&
      now.getTime() - job.createdAt.getTime() <= THIRTY_DAYS_MS,
  );
  return match?.id ?? null;
}
