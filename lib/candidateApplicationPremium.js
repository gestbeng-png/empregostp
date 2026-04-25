import {
  canAccessEarlyAccessJob,
  canAccessPremiumJob,
  canUseCoverLetter,
  canUsePremiumApplicationTools,
  getApplicationPriorityMetadata,
  getCandidatePlanFeatures,
  getPlanSummary,
} from './candidatePlanFeatures';

export const EARLY_ACCESS_HOUR_OPTIONS = [0, 6, 12, 24, 48, 72];

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeText(value = '') {
  return String(value || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitTextList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeText(item)).filter(Boolean);
  }

  return String(value || '')
    .split(/[\n,;]+/)
    .map((item) => sanitizeText(item))
    .filter(Boolean);
}

function getSafePlanSummary(planInput) {
  if (!planInput) {
    return {
      planId: 'basic_candidato',
      planName: 'Básico',
      isActive: true,
      features: getCandidatePlanFeatures('basic_candidato'),
    };
  }

  if (typeof planInput === 'string') {
    return {
      planId: planInput,
      planName: getCandidatePlanFeatures(planInput).name,
      isActive: true,
      features: getCandidatePlanFeatures(planInput),
    };
  }

  if (planInput.planId && planInput.features) {
    return {
      ...planInput,
      isActive: planInput.isActive !== false,
      features: planInput.features || getCandidatePlanFeatures(planInput.planId),
    };
  }

  return getPlanSummary(planInput);
}

export function normalizeEarlyAccessHours(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  if (EARLY_ACCESS_HOUR_OPTIONS.includes(numeric)) {
    return numeric;
  }

  if (numeric <= 6) return 6;
  if (numeric <= 12) return 12;
  if (numeric <= 24) return 24;
  if (numeric <= 48) return 48;
  return 72;
}

export function buildJobApplicationPremiumFields(input = {}, baseDate = new Date()) {
  const premiumOnly = Boolean(input.premiumOnly || input.applicationPremium?.premiumOnly);
  const requireCoverLetter = Boolean(input.requireCoverLetter || input.applicationPremium?.requireCoverLetter);
  const earlyAccessHours = normalizeEarlyAccessHours(
    input.earlyAccessHours ?? input.applicationPremium?.earlyAccessHours
  );

  const seedDate =
    parseDate(input.publishedAt) ||
    parseDate(input.createdAt) ||
    parseDate(baseDate) ||
    new Date();

  const earlyAccessUntilDate = earlyAccessHours > 0
    ? new Date(seedDate.getTime() + earlyAccessHours * 60 * 60 * 1000)
    : null;

  return {
    premiumOnly,
    requireCoverLetter,
    earlyAccessHours,
    earlyAccessUntil: earlyAccessUntilDate ? earlyAccessUntilDate.toISOString() : null,
  };
}

export function getJobApplicationPremiumConfig(job = {}, now = new Date()) {
  const premiumOnly = Boolean(job.premiumOnly || job.applicationPremium?.premiumOnly);
  const requireCoverLetter = Boolean(job.requireCoverLetter || job.applicationPremium?.requireCoverLetter);
  const earlyAccessHours = normalizeEarlyAccessHours(
    job.earlyAccessHours ?? job.applicationPremium?.earlyAccessHours
  );

  let earlyAccessUntil = parseDate(job.earlyAccessUntil || job.applicationPremium?.earlyAccessUntil);
  if (!earlyAccessUntil && earlyAccessHours > 0) {
    const seedDate = parseDate(job.publishedAt) || parseDate(job.createdAt);
    if (seedDate) {
      earlyAccessUntil = new Date(seedDate.getTime() + earlyAccessHours * 60 * 60 * 1000);
    }
  }

  const currentDate = parseDate(now) || new Date();
  const isEarlyAccessActive = Boolean(earlyAccessUntil && earlyAccessUntil.getTime() > currentDate.getTime());

  return {
    premiumOnly,
    requireCoverLetter,
    earlyAccessHours,
    earlyAccessUntil: earlyAccessUntil ? earlyAccessUntil.toISOString() : null,
    isEarlyAccessActive,
    hasPremiumFlow: premiumOnly || requireCoverLetter || earlyAccessHours > 0,
  };
}

export function getCandidatePremiumApplicationAccess(planInput) {
  const planSummary = getSafePlanSummary(planInput);
  const planId = planSummary.planId || 'basic_candidato';
  const priority = getApplicationPriorityMetadata(planId);
  const premiumJobs = canAccessPremiumJob(planId);
  const earlyAccess = canAccessEarlyAccessJob(planId);
  const premiumTools = canUsePremiumApplicationTools(planId);
  const coverLetter = canUseCoverLetter(planId);

  return {
    planSummary,
    canAccessPremiumJobs: premiumJobs.allowed,
    canAccessEarlyAccessJobs: earlyAccess.allowed,
    canUsePremiumApplicationTools: premiumTools.allowed,
    canUseCoverLetter: coverLetter.allowed,
    priorityApplied: priority.priorityApplied,
    highlighted: priority.highlighted,
    priorityLevel: priority.priorityLevel,
  };
}

export function evaluateCandidateJobAccess(job = {}, planInput, now = new Date()) {
  const config = getJobApplicationPremiumConfig(job, now);
  const candidateAccess = getCandidatePremiumApplicationAccess(planInput);

  if (config.premiumOnly && !candidateAccess.canAccessPremiumJobs) {
    const premiumCheck = canAccessPremiumJob(candidateAccess.planSummary.planId);
    return {
      allowed: false,
      code: 'PREMIUM_JOB_RESTRICTED',
      reason: premiumCheck.reason,
      upgradeMessage: premiumCheck.upgradeMessage,
      upgradeUrl: premiumCheck.upgradeUrl,
      config,
      candidateAccess,
    };
  }

  if (config.isEarlyAccessActive && !candidateAccess.canAccessEarlyAccessJobs) {
    const earlyAccessCheck = canAccessEarlyAccessJob(candidateAccess.planSummary.planId);
    return {
      allowed: false,
      code: 'EARLY_ACCESS_RESTRICTED',
      reason: earlyAccessCheck.reason,
      upgradeMessage: earlyAccessCheck.upgradeMessage,
      upgradeUrl: earlyAccessCheck.upgradeUrl,
      config,
      candidateAccess,
    };
  }

  return {
    allowed: true,
    config,
    candidateAccess,
  };
}

export function normalizeCoverLetter(value) {
  return sanitizeText(value);
}

export function buildCoverLetterSuggestion({ job = {}, userData = {}, profileData = {} }) {
  const candidateName = sanitizeText(userData.fullName || userData.name || profileData.fullName || '');
  const headline = sanitizeText(profileData.headline || profileData.profession || userData.headline || userData.profession || '');
  const objective = sanitizeText(profileData.objectiveArea || profileData.objectiveAspiration || userData.objectiveArea || '');
  const location = sanitizeText(profileData.city || profileData.location || userData.location || userData.localizacao || '');
  const skills = splitTextList([
    ...(splitTextList(profileData.skillsHard)),
    ...(splitTextList(profileData.skillsSoft)),
    ...(splitTextList(profileData.digitalSkills)),
    ...(splitTextList(userData.skills)),
  ]).slice(0, 3);
  const experienceEntries = Array.isArray(profileData.experience)
    ? profileData.experience.filter((entry) => entry && typeof entry === 'object')
    : [];

  const opening = candidateName
    ? `Prezada equipa, chamo-me ${candidateName} e gostaria de apresentar a minha candidatura para a vaga de ${job.titulo || job.title || 'esta função'}.`
    : `Prezada equipa, gostaria de apresentar a minha candidatura para a vaga de ${job.titulo || job.title || 'esta função'}.`;

  const valueProps = [];
  if (headline) valueProps.push(`atuo como ${headline}`);
  if (objective) valueProps.push(`tenho foco em ${objective}`);
  if (location) valueProps.push(`estou baseado em ${location}`);
  if (skills.length) valueProps.push(`destaco competências em ${skills.join(', ')}`);
  if (experienceEntries.length) {
    valueProps.push(`já reuni experiência prática em ${experienceEntries.length} contexto(s) profissional(is) relevante(s)`);
  }

  const middle = valueProps.length
    ? `Ao longo do meu percurso, ${valueProps.join(', ')}. Acredito que esta combinação pode acrescentar valor imediato à função e à equipa.`
    : 'Acredito que o meu perfil pode contribuir com compromisso, capacidade de aprendizagem e foco em resultados para a função anunciada.';

  const closing = `Tenho interesse em contribuir para ${job.companyName || job.empresaNome || job.empresa || 'a vossa organização'} e fico disponível para detalhar melhor a minha experiência numa próxima conversa. Obrigado pela atenção.`;

  return [opening, middle, closing].filter(Boolean).join('\n\n');
}
