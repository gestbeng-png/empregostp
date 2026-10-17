import { getDistrict, mapLegacyLocation } from '../geo/districts';
import { parseLegacySalary } from '../money/money';

/**
 * F8.6 — o que a URL de uma vaga devolve, por estado.
 *
 * Nunca 404 para uma vaga que esteve pública: encerrada/expirada/preenchida
 * → 200 com aviso e semelhantes (`noindex` 30 dias depois do fecho);
 * pausada/arquivada → 200 `noindex`; rejeitada por fraude → 410. Só
 * rascunhos e vagas em revisão (nunca públicas) dão 404.
 */
export type PublicJobPageKind =
  'OPEN' | 'CLOSED' | 'PAUSED' | 'ARCHIVED' | 'GONE' | 'NOT_FOUND';

export interface PublicJobPage {
  kind: PublicJobPageKind;
  httpStatus: 200 | 404 | 410;
  indexable: boolean;
  jsonLd: boolean;
}

const NOINDEX_AFTER_CLOSE_MS = 30 * 86_400_000;

const FROM_V2: Readonly<Record<string, PublicJobPageKind>> = {
  PUBLISHED: 'OPEN',
  CLOSED: 'CLOSED',
  EXPIRED: 'CLOSED',
  FILLED: 'CLOSED',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
  REJECTED: 'GONE',
  DRAFT: 'NOT_FOUND',
  PENDING_REVIEW: 'NOT_FOUND',
};
// Estados legados efetivos (`lib/jobExpiration.js`, `lib/jobModeration.js`).
const FROM_LEGACY: Readonly<Record<string, PublicJobPageKind>> = {
  active: 'OPEN',
  closed: 'CLOSED',
  inactive: 'PAUSED',
  // Desativada pela administração: tratada como retirada (410).
  disabled: 'GONE',
  rejected: 'GONE',
  draft: 'NOT_FOUND',
  pending_review: 'NOT_FOUND',
};

export function resolvePublicJobPage(input: {
  v2Status?: string | null;
  legacyStatus: string;
  closedAt: Date | null;
  now: Date;
}): PublicJobPage {
  const kind =
    (input.v2Status && FROM_V2[input.v2Status]) ||
    FROM_LEGACY[String(input.legacyStatus || '').toLowerCase()] ||
    'NOT_FOUND';
  if (kind === 'NOT_FOUND')
    return { kind, httpStatus: 404, indexable: false, jsonLd: false };
  if (kind === 'GONE')
    return { kind, httpStatus: 410, indexable: false, jsonLd: false };
  if (kind === 'OPEN')
    return { kind, httpStatus: 200, indexable: true, jsonLd: true };
  const recentlyClosed =
    kind === 'CLOSED' &&
    (!input.closedAt ||
      input.now.getTime() - input.closedAt.getTime() < NOINDEX_AFTER_CLOSE_MS);
  return { kind, httpStatus: 200, indexable: recentlyClosed, jsonLd: false };
}

// schema.org employmentType a partir dos valores legados e v2 (B9).
const EMPLOYMENT_TYPE: Readonly<Record<string, string>> = {
  'tempo integral': 'FULL_TIME',
  'tempo inteiro': 'FULL_TIME',
  'full time': 'FULL_TIME',
  tempo_inteiro: 'FULL_TIME',
  'meio periodo': 'PART_TIME',
  'tempo parcial': 'PART_TIME',
  'part time': 'PART_TIME',
  tempo_parcial: 'PART_TIME',
  contrato: 'CONTRACTOR',
  contract: 'CONTRACTOR',
  contrato_termo: 'TEMPORARY',
  consultoria: 'CONTRACTOR',
  freelance: 'CONTRACTOR',
  temporario: 'TEMPORARY',
  sazonal: 'TEMPORARY',
  estagio: 'INTERN',
  internship: 'INTERN',
  voluntariado: 'VOLUNTEER',
};

function employmentTypeOf(value: unknown): string | undefined {
  const key = String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .trim();
  return EMPLOYMENT_TYPE[key] ?? EMPLOYMENT_TYPE[key.replace(/\s+/g, '_')];
}

export interface JobPostingSource {
  id: string;
  title: string;
  descriptionHtml: string;
  publishedAt: Date | null;
  validThrough: Date | null;
  employmentType: unknown;
  companyName: string;
  companyWebsite?: string;
  companyLogo?: string;
  location: string;
  remote: boolean;
  salaryFrom?: unknown;
  salaryTo?: unknown;
  /** Período do salário; legado não o tem e então o salário é omitido. */
  salaryPeriod?: 'HOUR' | 'DAY' | 'MONTH' | 'YEAR' | null;
  createdAt: Date | null;
  url: string;
}

/**
 * F8.5 — JSON-LD `JobPosting` só com dados reais. Sem período conhecido o
 * salário é omitido (não se inventa "por mês" para o Google); salários
 * legados suspeitos de STD também.
 */
export function buildJobPostingJsonLd(
  job: JobPostingSource,
): Record<string, unknown> {
  const posting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.descriptionHtml,
    identifier: { '@type': 'PropertyValue', name: 'EmpregoSTP', value: job.id },
    url: job.url,
    directApply: true,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companyName,
      ...(job.companyWebsite ? { sameAs: job.companyWebsite } : {}),
      ...(job.companyLogo ? { logo: job.companyLogo } : {}),
    },
  };
  if (job.publishedAt) posting.datePosted = job.publishedAt.toISOString();
  if (job.validThrough) posting.validThrough = job.validThrough.toISOString();
  const employmentType = employmentTypeOf(job.employmentType);
  if (employmentType) posting.employmentType = employmentType;

  if (job.remote) {
    posting.jobLocationType = 'TELECOMMUTE';
    posting.applicantLocationRequirements = { '@type': 'Country', name: 'ST' };
  } else {
    const mapping = mapLegacyLocation(job.location);
    const district = mapping.district
      ? getDistrict(mapping.district)
      : undefined;
    posting.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(district && district.slug !== 'remoto'
          ? { addressLocality: job.location, addressRegion: district.name }
          : {}),
        addressCountry: 'ST',
      },
    };
  }

  if (job.salaryPeriod) {
    const from = parseLegacySalary(job.salaryFrom, job.createdAt);
    const to = parseLegacySalary(job.salaryTo, job.createdAt);
    const usable = [from, to].filter(
      (value) => value.amountMinor !== null && !value.needsReview,
    );
    if (usable.length && !from.needsReview && !to.needsReview) {
      const min = (from.amountMinor ?? to.amountMinor ?? 0) / 100;
      const max = (to.amountMinor ?? from.amountMinor ?? 0) / 100;
      posting.baseSalary = {
        '@type': 'MonetaryAmount',
        currency: 'STN',
        value: {
          '@type': 'QuantitativeValue',
          ...(min === max ? { value: min } : { minValue: min, maxValue: max }),
          unitText: job.salaryPeriod,
        },
      };
    }
  }
  return posting;
}

/** Serialização segura para `<script type="application/ld+json">`. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
