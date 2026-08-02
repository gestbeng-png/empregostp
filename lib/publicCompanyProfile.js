import { normalizeExternalUrl } from './externalUrl';
import { isJobPubliclyVisible } from './jobExpiration';
import { projectPublicJob } from './publicJob';

export const PUBLIC_COMPANY_JOBS_LIMIT = 12;

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeModality(job = {}) {
  const explicitModality = String(job.modalidade || job.modality || '').trim();
  const normalizedModality = explicitModality.toLowerCase();

  if (
    normalizedModality.includes('híbrido') ||
    normalizedModality.includes('hibrido')
  ) {
    return 'Híbrido';
  }

  if (
    job.remoto === true ||
    job.remote === true ||
    normalizedModality.includes('remoto')
  ) {
    return 'Remoto';
  }

  if (explicitModality) return explicitModality;
  if (job.remoto === false || job.remote === false) return 'Presencial';
  return '';
}

export function normalizeCompanyProfileJob(job = {}) {
  const publicJob = projectPublicJob(job);

  return {
    id: publicJob.id,
    title: publicJob.titulo,
    status: publicJob.status,
    location: publicJob.localizacao,
    contractType: publicJob.tipoContrato,
    category: publicJob.categoria,
    modality: normalizeModality(job),
    experience:
      job.nivelExperiencia ||
      job.experiencia ||
      publicJob.nivelExperiencia ||
      '',
    salaryMin: job.salarioDe ?? publicJob.salarioDe,
    salaryMax: job.salarioAte ?? publicJob.salarioAte,
    salary: job.salario || job.salary || '',
    currency: job.currency || job.moeda || 'Db',
    vacancyCount:
      Number(job.vagasDisponiveis ?? publicJob.vagasDisponiveis) || 1,
    featured: Boolean(publicJob.destaque),
    createdAt: toIsoDate(
      job.publicadoEm ||
        job.publishedAt ||
        job.createdAt ||
        publicJob.createdAt,
    ),
    deadline: toIsoDate(
      job.dataFecho ||
        job.expiresAt ||
        publicJob.dataFecho ||
        publicJob.expiresAt,
    ),
  };
}

export function prepareCompanyProfileJobs(
  rawJobs = [],
  { limit = PUBLIC_COMPANY_JOBS_LIMIT, now = new Date() } = {},
) {
  const visibleJobs = rawJobs
    .filter((job) => isJobPubliclyVisible(job, now))
    .sort((left, right) => {
      const leftTime = new Date(
        toIsoDate(left.publicadoEm || left.publishedAt || left.createdAt) || 0,
      ).getTime();
      const rightTime = new Date(
        toIsoDate(right.publicadoEm || right.publishedAt || right.createdAt) ||
          0,
      ).getTime();
      return rightTime - leftTime;
    });

  return {
    activeJobCount: visibleJobs.length,
    jobs: visibleJobs
      .slice(0, Math.max(0, limit))
      .map(normalizeCompanyProfileJob),
  };
}

export function normalizeCompanyWebsite(value) {
  return normalizeExternalUrl(value);
}
