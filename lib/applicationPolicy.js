import {
  canUsePremiumApplicationTools,
  getCandidatePlanFeatures,
  getPlanSummary,
} from './candidatePlanFeatures';

function sanitizeText(value = '') {
  return String(value || '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
      features:
        planInput.features || getCandidatePlanFeatures(planInput.planId),
    };
  }

  return getPlanSummary(planInput);
}

export function buildJobApplicationPolicy(input = {}, _baseDate = new Date()) {
  return {
    premiumOnly: false,
    requireCoverLetter: Boolean(
      input.requireCoverLetter || input.applicationPremium?.requireCoverLetter,
    ),
    earlyAccessHours: 0,
    earlyAccessUntil: null,
  };
}

export function getJobApplicationPolicy(job = {}, _now = new Date()) {
  const requireCoverLetter = Boolean(
    job.requireCoverLetter || job.applicationPremium?.requireCoverLetter,
  );
  return {
    premiumOnly: false,
    requireCoverLetter,
    earlyAccessHours: 0,
    earlyAccessUntil: null,
    isEarlyAccessActive: false,
  };
}

export function getCandidateApplicationAccess(planInput) {
  const planSummary = getSafePlanSummary(planInput);
  const planId = planSummary.planId || 'basic_candidato';
  return {
    planSummary,
    canAccessPremiumJobs: true,
    canAccessEarlyAccessJobs: true,
    canUsePremiumApplicationTools:
      canUsePremiumApplicationTools(planId).allowed,
    canUseCoverLetter: true,
    priorityApplied: false,
    highlighted: false,
    priorityLevel: 0,
  };
}

export function evaluateCandidateJobAccess(
  job = {},
  planInput,
  now = new Date(),
) {
  return {
    allowed: true,
    config: getJobApplicationPolicy(job, now),
    candidateAccess: getCandidateApplicationAccess(planInput),
  };
}

export function normalizeCoverLetter(value) {
  return sanitizeText(value);
}

export function buildCoverLetterSuggestion({
  job = {},
  userData = {},
  profileData = {},
}) {
  const candidateName = sanitizeText(
    userData.fullName || userData.name || profileData.fullName || '',
  );
  const headline = sanitizeText(
    profileData.headline ||
      profileData.profession ||
      userData.headline ||
      userData.profession ||
      '',
  );
  const objective = sanitizeText(
    profileData.objectiveArea ||
      profileData.objectiveAspiration ||
      userData.objectiveArea ||
      '',
  );
  const location = sanitizeText(
    profileData.city ||
      profileData.location ||
      userData.location ||
      userData.localizacao ||
      '',
  );
  const skills = splitTextList([
    ...splitTextList(profileData.skillsHard),
    ...splitTextList(profileData.skillsSoft),
    ...splitTextList(profileData.digitalSkills),
    ...splitTextList(userData.skills),
  ]).slice(0, 3);
  const experienceEntries = Array.isArray(profileData.experience)
    ? profileData.experience.filter(
        (entry) => entry && typeof entry === 'object',
      )
    : [];

  const opening = candidateName
    ? `Prezada equipa, chamo-me ${candidateName} e gostaria de apresentar a minha candidatura para a vaga de ${job.titulo || job.title || 'esta função'}.`
    : `Prezada equipa, gostaria de apresentar a minha candidatura para a vaga de ${job.titulo || job.title || 'esta função'}.`;

  const valueProps = [];
  if (headline) valueProps.push(`atuo como ${headline}`);
  if (objective) valueProps.push(`tenho foco em ${objective}`);
  if (location) valueProps.push(`estou baseado em ${location}`);
  if (skills.length)
    valueProps.push(`destaco competências em ${skills.join(', ')}`);
  if (experienceEntries.length) {
    valueProps.push(
      `já reuni experiência prática em ${experienceEntries.length} contexto(s) profissional(is) relevante(s)`,
    );
  }

  const middle = valueProps.length
    ? `Ao longo do meu percurso, ${valueProps.join(', ')}. Acredito que esta combinação pode acrescentar valor imediato à função e à equipa.`
    : 'Acredito que o meu perfil pode contribuir com compromisso, capacidade de aprendizagem e foco em resultados para a função anunciada.';

  const closing = `Tenho interesse em contribuir para ${job.companyName || job.empresaNome || job.empresa || 'a vossa organização'} e fico disponível para detalhar melhor a minha experiência numa próxima conversa. Obrigado pela atenção.`;

  return [opening, middle, closing].filter(Boolean).join('\n\n');
}
