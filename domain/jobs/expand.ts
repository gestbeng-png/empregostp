/**
 * D7 (expand) — campos v2 a acrescentar a uma vaga a partir dos campos
 * legados, sem apagar nem alterar nenhum. Usado pelo backfill e pela criação
 * de vagas no caminho v2. O que não converte com segurança vai para a fila
 * de revisão (`review`), nunca para um valor adivinhado (B2, B3, B10).
 */
import { mapLegacyLocation } from '../geo/districts';
import { parseLegacySalary } from '../money/money';
import type { SalaryType } from '../money/money';

import { legacyStatusFromJob } from './legacyView';
import { detectMultipleRoles } from './multiRole';
import {
  mapLegacyCategory,
  mapLegacyEducation,
  mapLegacyEmploymentType,
  mapLegacySeniority,
} from './taxonomy';

export const JOB_EXPAND_VERSION = 1;

export type JobReviewCode =
  | 'LOCATION_UNMAPPED'
  | 'SALARY_SUSPECT_STD'
  | 'SALARY_UNPARSEABLE'
  | 'SALARY_PERIOD_MISSING'
  | 'SALARY_RANGE_INVALID'
  | 'CATEGORY_UNMAPPED'
  | 'CONTRACT_UNMAPPED'
  | 'MULTI_ROLE_TITLE';

export interface JobExpandPlan {
  fields: Record<string, unknown>;
  review: JobReviewCode[];
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => unknown }).toDate();
    return date instanceof Date ? date : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function planJobExpand(
  job: Readonly<Record<string, unknown>>,
): JobExpandPlan {
  const review: JobReviewCode[] = [];
  const lifecycle = legacyStatusFromJob(job);
  const createdAt = toDate(job.createdAt);

  const location = mapLegacyLocation(job.localizacao ?? job.location);
  const remote = job.remoto === true;
  if (!location.district && !remote) review.push('LOCATION_UNMAPPED');

  const min = parseLegacySalary(job.salarioDe, createdAt);
  const max = parseLegacySalary(job.salarioAte, createdAt);
  let salaryType: SalaryType = 'UNDISCLOSED';
  if (min.amountMinor !== null && max.amountMinor !== null)
    salaryType = min.amountMinor === max.amountMinor ? 'FIXED' : 'RANGE';
  else if (min.amountMinor !== null) salaryType = 'FROM';
  else if (max.amountMinor !== null) salaryType = 'FIXED';
  const rangeInvalid =
    salaryType === 'RANGE' &&
    min.amountMinor !== null &&
    max.amountMinor !== null &&
    min.amountMinor > max.amountMinor;
  const salaryNeedsReview = min.needsReview || max.needsReview || rangeInvalid;
  if (min.needsReview || max.needsReview)
    review.push(
      [job.salarioDe, job.salarioAte].some(
        (value) =>
          value !== undefined &&
          value !== null &&
          value !== '' &&
          !/\d/.test(String(value)),
      )
        ? 'SALARY_UNPARSEABLE'
        : 'SALARY_SUSPECT_STD',
    );
  if (rangeInvalid) review.push('SALARY_RANGE_INVALID');
  // O formulário antigo não pede período: nunca assumir «por mês» (B3/F1.4).
  if (salaryType !== 'UNDISCLOSED') review.push('SALARY_PERIOD_MISSING');

  const categoryId = mapLegacyCategory(job.categoria ?? job.category);
  if (!categoryId && (job.categoria || job.category))
    review.push('CATEGORY_UNMAPPED');
  const employmentType = mapLegacyEmploymentType(
    job.tipoContrato ?? job.contractType,
  );
  if (!employmentType) review.push('CONTRACT_UNMAPPED');
  // F1.1: dados antigos com várias funções não são divididos, só marcados.
  if (
    detectMultipleRoles(String(job.titulo ?? job.title ?? '')).verdict !==
    'SINGLE'
  )
    review.push('MULTI_ROLE_TITLE');

  const vacancies = Number.parseInt(String(job.vagasDisponiveis ?? 1), 10);
  return {
    fields: {
      v2Status: lifecycle.status,
      version: lifecycle.version || 1,
      organizationId: lifecycle.organizationId,
      district: location.district,
      legacyLocation: location.legacyLocation,
      // O formulário pergunta «remoto» explicitamente: desmarcado = presencial.
      workMode: remote ? 'REMOTO' : job.remoto === false ? 'PRESENCIAL' : null,
      employmentType,
      seniority: mapLegacySeniority(job.nivelExperiencia),
      educationLevelMin: mapLegacyEducation(job.escolaridade),
      categoryId,
      secondaryCategoryIds: [],
      vacanciesCount:
        Number.isSafeInteger(vacancies) && vacancies >= 1 && vacancies <= 500
          ? vacancies
          : 1,
      salaryType,
      salaryMinMinor:
        salaryType === 'UNDISCLOSED'
          ? null
          : (min.amountMinor ?? max.amountMinor),
      salaryMaxMinor:
        salaryType === 'RANGE' || salaryType === 'FIXED'
          ? (max.amountMinor ?? min.amountMinor)
          : null,
      salaryCurrency: 'STN',
      salaryPeriod: null,
      salaryNeedsReview,
      applicationMethod: lifecycle.applicationMethod,
      applicationDeadline: lifecycle.applicationDeadline,
      sourceType: 'EMPLOYER_DIRECT',
      expandVersion: JOB_EXPAND_VERSION,
    },
    review: [...new Set(review)],
  };
}

/**
 * D7 migrate — o que o backfill escreve numa vaga existente: só campos v2
 * ainda ausentes (nunca sobrescreve um valor já expandido nem um campo
 * legado). `null` quando a vaga já está na versão atual do expand.
 */
export function planJobBackfillWrite(
  job: Readonly<Record<string, unknown>>,
): { set: Record<string, unknown>; review: JobReviewCode[] } | null {
  if (
    typeof job.expandVersion === 'number' &&
    job.expandVersion >= JOB_EXPAND_VERSION
  )
    return null;
  const plan = planJobExpand(job);
  const set: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(plan.fields))
    if (!Object.hasOwn(job, field) || job[field] === undefined)
      set[field] = value;
  set.expandVersion = JOB_EXPAND_VERSION;
  return { set, review: plan.review };
}
