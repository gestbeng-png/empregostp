import type { SalaryType } from '../money/money';

import { detectMultipleRoles } from './multiRole';

/**
 * F1.2 — quality score (0–100), determinístico e nunca dependente de
 * pagamento. < 50 não publica (checklist do que falta, por pontos); 50–69
 * publica com sugestões; ≥ 70 "Vaga completa" (selo interno).
 */
export type VerificationLevel =
  | 'REGISTERED'
  | 'CONTACT_VERIFIED'
  | 'ORGANIZATION_VERIFIED'
  | 'TRUSTED_PARTNER';

export interface QualityInput {
  title: string;
  description: string;
  responsibilities: readonly string[];
  requirements: readonly string[];
  skills: readonly string[];
  salaryType: SalaryType;
  district: string | null;
  workMode: string | null;
  employmentType: string | null;
  applicationDeadline: Date | null;
  organizationVerification: VerificationLevel;
}

export type QualityCriterion =
  | 'TITLE'
  | 'DESCRIPTION'
  | 'RESPONSIBILITIES'
  | 'REQUIREMENTS'
  | 'SKILLS'
  | 'SALARY'
  | 'LOCATION_MODE'
  | 'CONTRACT'
  | 'DEADLINE'
  | 'ORGANIZATION';

const MAX: Readonly<Record<QualityCriterion, number>> = {
  TITLE: 10,
  DESCRIPTION: 15,
  RESPONSIBILITIES: 10,
  REQUIREMENTS: 10,
  SKILLS: 10,
  SALARY: 15,
  LOCATION_MODE: 10,
  CONTRACT: 5,
  DEADLINE: 5,
  ORGANIZATION: 10,
};

export const QUALITY_CHECKLIST: Readonly<Record<QualityCriterion, string>> = {
  TITLE:
    'Título com uma só função, 10 a 80 caracteres, sem maiúsculas integrais nem emojis',
  DESCRIPTION: 'Descrição com pelo menos 300 caracteres',
  RESPONSIBILITIES: 'Pelo menos 3 responsabilidades',
  REQUIREMENTS: 'Pelo menos 2 requisitos',
  SKILLS: 'Pelo menos 3 competências',
  SALARY: 'Divulgar o salário',
  LOCATION_MODE: 'Indicar o distrito e o modo de trabalho',
  CONTRACT: 'Indicar o tipo de contrato',
  DEADLINE: 'Definir o prazo de candidatura',
  ORGANIZATION: 'Verificar a organização',
};

const EMOJI = /\p{Extended_Pictographic}/u;

export function usefulText(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filled(items: readonly string[]): number {
  return items.filter((item) => usefulText(item).length > 0).length;
}

function titleOk(title: string): boolean {
  const text = String(title ?? '').trim();
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return (
    text.length >= 10 &&
    text.length <= 80 &&
    !EMOJI.test(text) &&
    !(letters.length > 3 && letters === letters.toUpperCase()) &&
    detectMultipleRoles(text).verdict === 'SINGLE'
  );
}

export type QualityBand = 'BLOCKED' | 'PUBLISHABLE' | 'COMPLETE';
export interface QualityResult {
  score: number;
  band: QualityBand;
  breakdown: Record<QualityCriterion, number>;
  /** O que falta, ordenado pelos pontos a ganhar (maior primeiro). */
  missing: { criterion: QualityCriterion; points: number; label: string }[];
}

export function computeQualityScore(input: QualityInput): QualityResult {
  const breakdown: Record<QualityCriterion, number> = {
    TITLE: titleOk(input.title) ? 10 : 0,
    DESCRIPTION: usefulText(input.description).length >= 300 ? 15 : 0,
    RESPONSIBILITIES: filled(input.responsibilities) >= 3 ? 10 : 0,
    REQUIREMENTS: filled(input.requirements) >= 2 ? 10 : 0,
    SKILLS: filled(input.skills) >= 3 ? 10 : 0,
    SALARY: ['FIXED', 'RANGE', 'FROM'].includes(input.salaryType)
      ? 15
      : input.salaryType === 'NEGOTIABLE'
        ? 5
        : 0,
    LOCATION_MODE: input.district && input.workMode ? 10 : 0,
    CONTRACT: input.employmentType ? 5 : 0,
    DEADLINE: input.applicationDeadline ? 5 : 0,
    ORGANIZATION:
      input.organizationVerification === 'ORGANIZATION_VERIFIED' ||
      input.organizationVerification === 'TRUSTED_PARTNER'
        ? 10
        : input.organizationVerification === 'CONTACT_VERIFIED'
          ? 5
          : 0,
  };
  const score = Object.values(breakdown).reduce(
    (sum, points) => sum + points,
    0,
  );
  const missing = (Object.keys(MAX) as QualityCriterion[])
    .map((criterion) => ({
      criterion,
      points: MAX[criterion] - breakdown[criterion],
      label: QUALITY_CHECKLIST[criterion],
    }))
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points);
  return {
    score,
    band: score < 50 ? 'BLOCKED' : score < 70 ? 'PUBLISHABLE' : 'COMPLETE',
    breakdown,
    missing,
  };
}
