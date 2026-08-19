import { getPublicSkillsAssessment } from './skillsAssessment';

function normalizeJobIdentityPart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT');
}

export function deduplicateRelatedJobs(jobs = []) {
  const seen = new Set();

  return jobs.filter((job) => {
    const signature = [
      job.titulo || job.title,
      job.empresaNome || job.companyName,
      job.localizacao || job.location,
      job.tipoContrato || job.contractType,
    ]
      .map(normalizeJobIdentityPart)
      .join('|');

    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function filterPublicJobsByCompany(jobs = [], companyId = '') {
  const normalizedCompanyId = String(companyId || '').trim();
  if (!normalizedCompanyId) return jobs;
  return jobs.filter((job) => job.companyId === normalizedCompanyId);
}

/**
 * Projeta uma vaga para superfícies públicas.
 *
 * Os documentos Firestore podem conter campos operacionais (por exemplo,
 * respostas de avaliações, autor administrativo e informação de plano).
 * Manter uma allowlist aqui evita que novos campos internos sejam publicados
 * acidentalmente por um spread de `doc.data()`.
 */
export function projectPublicJob(job = {}) {
  const remoteValue = job.remoto ?? job.remote;
  const title = job.titulo || job.title || 'Sem título';
  const description = job.descricao || job.description || '';
  const location =
    job.localizacao || job.location || job.cidade || 'Local não especificado';
  const contractType =
    job.tipoContrato || job.contractType || job.tipo || 'Não informado';
  const experience =
    job.nivelExperiencia || job.experiencia || job.experience || '';
  const salaryFrom =
    job.salarioDe ?? job.salaryMin ?? job.salarioMin ?? job.salarioMinimo ?? '';
  const salaryTo =
    job.salarioAte ??
    job.salaryMax ??
    job.salarioMax ??
    job.salarioMaximo ??
    '';
  const companyName =
    job.companyName || job.empresaNome || job.empresa || 'Empresa Confidencial';
  const publishedAt =
    job.publicadoEm || job.publishedAt || job.createdAt || null;
  const closingAt =
    job.dataFecho ||
    job.expiresAt ||
    job.deadline ||
    job.prazo ||
    job.dataLimite ||
    null;
  const tdrUrl =
    job.tdrUrl ||
    job.tdrURL ||
    job.tdr_url ||
    job.tdr ||
    job.termosReferenciaUrl ||
    job.termosReferencia ||
    job.tdrLink ||
    job.tdrPdf ||
    job.tdrFile ||
    job.tdrArquivo ||
    job.documentoTdr ||
    job.termosReferenciaArquivo ||
    job.ficheiroTdr ||
    '';
  const rawVacancyCount =
    job.vagasDisponiveis ?? job.vacancyCount ?? job.numeroVagas ?? 1;
  const parsedVacancyCount =
    rawVacancyCount === '' ? 1 : Number(rawVacancyCount);
  const vacancyCount = Number.isFinite(parsedVacancyCount)
    ? Math.max(0, parsedVacancyCount)
    : 1;

  return {
    id: job.id,
    titulo: title,
    title,
    descricao: description,
    description,
    requisitos: job.requisitos || job.requirements || '',
    responsabilidades: job.responsabilidades || job.responsibilities || '',
    beneficios: job.beneficios || job.benefits || '',
    localizacao: location,
    location,
    tipoContrato: contractType,
    contractType,
    nivelExperiencia: experience,
    experiencia: experience,
    experience,
    escolaridade: job.escolaridade || job.education || '',
    salarioDe: salaryFrom,
    salarioAte: salaryTo,
    salaryMin: salaryFrom,
    salaryMax: salaryTo,
    currency: job.currency || job.moeda || 'STD',
    dataAbertura: job.dataAbertura || job.openingDate || null,
    dataFecho: closingAt,
    deadline: closingAt,
    expiresAt: closingAt,
    remoto: typeof remoteValue === 'boolean' ? remoteValue : null,
    modalidade: job.modalidade || job.modality || '',
    regime: job.regime || '',
    destaque: Boolean(job.destaque ?? job.featured ?? job.isFeatured),
    featured: Boolean(job.destaque ?? job.featured ?? job.isFeatured),
    vagasDisponiveis: vacancyCount,
    palavrasChave: Array.isArray(job.palavrasChave)
      ? job.palavrasChave
      : Array.isArray(job.keywords)
        ? job.keywords
        : [],
    categoria: job.categoria || job.category || '',
    status: job.status || 'active',
    companyId: job.companyId || '',
    companyName,
    empresaNome: companyName,
    companyLogo: job.companyLogo || job.empresaLogo || '',
    empresaLogo: job.empresaLogo || job.companyLogo || '',
    companyVerified: Boolean(job.companyVerified),
    companyDescription: job.companyDescription || '',
    coverImageUrl:
      job.coverImageUrl ||
      job.coverImage ||
      job.imagemCapa ||
      job.bannerUrl ||
      '',
    companyLocation: job.companyLocation || '',
    companyPhone: job.companyPhone || '',
    companyEmail: job.companyEmail || '',
    companyWebsite: job.companyWebsite || '',
    premiumOnly: Boolean(job.premiumOnly || job.isPremiumOnly),
    earlyAccessUntil: job.earlyAccessUntil || null,
    requireCoverLetter: Boolean(job.requireCoverLetter),
    skillsAssessment: getPublicSkillsAssessment(job.skillsAssessment),
    tdrUrl,
    tdrFileName: job.tdrFileName || '',
    applicationCount: Number(
      job.applicationCount ||
        job.applicationsCount ||
        job.candidaturasCount ||
        job.totalApplications ||
        0,
    ),
    createdAt: job.createdAt || publishedAt,
    updatedAt: job.updatedAt || null,
    publishedAt,
    publicadoEm: publishedAt,
  };
}
