import {
  getPlanSummary,
  hasActivePremiumVerification,
} from './candidatePlanFeatures';

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (!value) return [];

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'object') {
    return Object.values(value)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  return [];
}

function uniqueList(values = []) {
  return [
    ...new Set(values.map((item) => String(item || '').trim()).filter(Boolean)),
  ];
}

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function hasMeaningfulText(value, minLength = 20) {
  return String(value || '').trim().length >= minLength;
}

function getDateMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date ? parsed.getTime() : 0;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getExperienceEntries(profileData = {}, userData = {}) {
  const profileExperiences = Array.isArray(profileData.experience)
    ? profileData.experience
    : [];
  const userExperiences = Array.isArray(userData.experience)
    ? userData.experience
    : [];
  return [...profileExperiences, ...userExperiences].filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return Object.values(entry).some((value) => hasValue(value));
  });
}

function getCandidateName(userData = {}, profileData = {}) {
  return (
    userData.fullName ||
    userData.name ||
    profileData.fullName ||
    profileData.name ||
    ''
  );
}

function getCandidateHeadline(userData = {}, profileData = {}) {
  return (
    profileData.headline ||
    profileData.profession ||
    userData.headline ||
    userData.profession ||
    ''
  );
}

function getCandidateLocation(userData = {}, profileData = {}) {
  return (
    profileData.city ||
    profileData.location ||
    userData.location ||
    userData.localizacao ||
    userData.cidade ||
    ''
  );
}

function getCandidatePhone(userData = {}, profileData = {}) {
  return userData.phone || profileData.phone || '';
}

function getCandidatePhoto(userData = {}, profileData = {}) {
  return userData.photoUrl || userData.photo || profileData.photoUrl || '';
}

function getCandidateCvUrl(userData = {}, profileData = {}) {
  return profileData.cvUrl || userData.cvUrl || '';
}

function getCandidateObjective(profileData = {}, userData = {}) {
  return (
    profileData.objectiveArea ||
    profileData.objectiveAspiration ||
    userData.objectiveArea ||
    ''
  );
}

function getCandidateSkills(userData = {}, profileData = {}) {
  return uniqueList([
    ...toArray(profileData.skillsHard),
    ...toArray(profileData.skillsSoft),
    ...toArray(profileData.digitalSkills),
    ...toArray(userData.skills),
  ]);
}

function getCandidateAvailableForWork(userData = {}, profileData = {}) {
  return Boolean(profileData.availableForWork || userData.availableForWork);
}

function getReviewedVerificationDecision(userData, profileData) {
  for (const data of [userData, profileData]) {
    if (data.verificationMethod === 'competencies') {
      const competenceStatus =
        data.verificationItems?.competencies?.status ||
        data.verificationSummary?.types?.competencies?.status;
      if (
        ['approved', 'pending', 'rejected', 'not_requested'].includes(
          competenceStatus,
        )
      ) {
        return competenceStatus === 'approved';
      }
    }
    const identityStatus =
      data.verificationItems?.identity?.status ||
      data.verificationSummary?.identityStatus;
    if (
      ['approved', 'pending', 'rejected', 'not_requested'].includes(
        identityStatus,
      )
    ) {
      return identityStatus === 'approved';
    }
    const status = normalizeText(data.verificationStatus);
    if (['verified', 'approved'].includes(status)) return true;
    if (['pending', 'rejected', 'revoked', 'unverified'].includes(status))
      return false;
  }
  return null;
}

function hasReviewedCandidateVerification(userData = {}, profileData = {}) {
  const reviewedDecision = getReviewedVerificationDecision(
    userData,
    profileData,
  );
  if (reviewedDecision !== null) return reviewedDecision;
  const userVerificationStatus = String(
    userData.verificationStatus || '',
  ).toLowerCase();
  const profileVerificationStatus = String(
    profileData.verificationStatus || '',
  ).toLowerCase();

  return Boolean(
    userData.verified ||
    userData.verificado ||
    userData.isVerified ||
    profileData.verified ||
    profileData.verificado ||
    profileData.isVerified ||
    userVerificationStatus === 'verified' ||
    userVerificationStatus === 'approved' ||
    profileVerificationStatus === 'verified' ||
    profileVerificationStatus === 'approved',
  );
}

export function isCandidateVerified(userData = {}, profileData = {}) {
  const verification = getCandidateVerification(userData, profileData);
  return verification.paid || verification.qualified;
}

/**
 * As duas origens públicas de verificação de candidato.
 *
 * `paid` preserva também os registos legados que só tinham `verified: true`.
 * Premium ativo concede `paid`; não aprova documentos nem competências.
 * `qualified` exige aprovação administrativa das competências, nunca compra.
 */
export function getCandidateVerification(userData = {}, profileData = {}) {
  const completion = calculateCandidateProfileCompletion(userData, profileData);
  const disabled = userData.verificationDisabled === true;
  const verified =
    !disabled && hasReviewedCandidateVerification(userData, profileData);
  const premiumVerified = hasActivePremiumVerification(userData);
  const hasCv = hasValue(getCandidateCvUrl(userData, profileData));
  const hasExperienceOrEducation =
    getExperienceEntries(profileData, userData).length > 0 ||
    hasMeaningfulText(profileData.education || userData.education, 10);
  const skillsCount = getCandidateSkills(userData, profileData).length;
  const qualificationEligible = Boolean(
    completion.isProfileComplete &&
    completion.score >= 80 &&
    hasCv &&
    hasExperienceOrEducation &&
    skillsCount >= 3,
  );

  const explicitTypes = [
    ...(Array.isArray(userData.verificationTypes)
      ? userData.verificationTypes
      : []),
    ...(Array.isArray(profileData.verificationTypes)
      ? profileData.verificationTypes
      : []),
  ].map((type) => String(type || '').toLowerCase());
  const qualificationReview =
    userData.verificationMethod === 'competencies' ||
    profileData.verificationMethod === 'competencies' ||
    explicitTypes.includes('qualified') ||
    userData.verificationType === 'qualified' ||
    profileData.verificationType === 'qualified';
  const qualified = Boolean(verified && qualificationReview);
  const reviewedPaid =
    getReviewedVerificationDecision(userData, profileData) !== null
      ? verified && !qualificationReview
      : Boolean(
          explicitTypes.includes('paid') ||
          userData.verificationType === 'paid' ||
          profileData.verificationType === 'paid' ||
          // Compatibilidade com o modelo anterior: verified significava revisão paga.
          verified,
        );
  const paid = !disabled && (premiumVerified || reviewedPaid);

  const types = [
    ...(paid ? ['paid'] : []),
    ...(qualified ? ['qualified'] : []),
  ];

  return {
    paid,
    premiumVerified,
    qualified,
    types,
    primaryType: types.includes('paid') ? 'paid' : types[0] || null,
    qualificationScore: completion.score,
    qualificationEligible,
    qualificationLabel: qualified ? 'Altamente qualificado' : completion.label,
  };
}

const COMPLETION_RULES = [
  {
    id: 'name',
    label: 'Nome completo',
    hint: 'Adicione o nome pelo qual as empresas o devem identificar.',
    weight: 10,
    check: ({ userData, profileData }) =>
      hasValue(getCandidateName(userData, profileData)),
  },
  {
    id: 'headline',
    label: 'Titulo profissional',
    hint: 'Escreva um titulo claro com funcao, area ou especialidade.',
    weight: 10,
    check: ({ userData, profileData }) =>
      hasValue(getCandidateHeadline(userData, profileData)),
  },
  {
    id: 'location',
    label: 'Localizacao',
    hint: 'Informe a cidade ou zona principal de trabalho.',
    weight: 8,
    check: ({ userData, profileData }) =>
      hasValue(getCandidateLocation(userData, profileData)),
  },
  {
    id: 'contact',
    label: 'Contacto completo',
    hint: 'Tenha email e telefone atualizados.',
    weight: 10,
    check: ({ userData, profileData }) =>
      hasValue(userData.email) &&
      hasValue(getCandidatePhone(userData, profileData)),
  },
  {
    id: 'photo',
    label: 'Foto de perfil',
    hint: 'Perfis com foto transmitem mais confianca.',
    weight: 8,
    check: ({ userData, profileData }) =>
      hasValue(getCandidatePhoto(userData, profileData)),
  },
  {
    id: 'bio',
    label: 'Resumo profissional',
    hint: 'Explique em poucas linhas o seu foco e valor profissional.',
    weight: 10,
    check: ({ userData, profileData }) =>
      hasMeaningfulText(profileData.bio || userData.bio || userData.sobre, 40),
  },
  {
    id: 'objective',
    label: 'Objetivo profissional',
    hint: 'Defina a area ou aspiracao que procura.',
    weight: 10,
    check: ({ userData, profileData }) =>
      hasValue(getCandidateObjective(profileData, userData)),
  },
  {
    id: 'skills',
    label: 'Competencias-chave',
    hint: 'Adicione pelo menos 3 competencias relevantes.',
    weight: 12,
    check: ({ userData, profileData }) =>
      getCandidateSkills(userData, profileData).length >= 3,
  },
  {
    id: 'experience',
    label: 'Experiencia ou formacao',
    hint: 'Inclua experiencia profissional ou formacao academica.',
    weight: 12,
    check: ({ userData, profileData }) =>
      getExperienceEntries(profileData, userData).length > 0 ||
      hasMeaningfulText(profileData.education, 10),
  },
  {
    id: 'cv',
    label: 'CV anexado',
    hint: 'Carregue um CV atualizado para fortalecer o perfil.',
    weight: 10,
    check: ({ userData, profileData }) =>
      hasValue(getCandidateCvUrl(userData, profileData)),
  },
];

export function calculateCandidateProfileCompletion(
  userData = {},
  profileData = {},
) {
  const context = { userData, profileData };

  const checklist = COMPLETION_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    hint: rule.hint,
    weight: rule.weight,
    completed: Boolean(rule.check(context)),
  }));

  const totalWeight = checklist.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = checklist.reduce(
    (sum, item) => sum + (item.completed ? item.weight : 0),
    0,
  );
  const score =
    totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  const criticalItems = new Set([
    'name',
    'contact',
    'objective',
    'skills',
    'experience',
    'cv',
  ]);
  const missingCriticalItems = checklist.filter(
    (item) => criticalItems.has(item.id) && !item.completed,
  );
  const completedCount = checklist.filter((item) => item.completed).length;
  const missingItems = checklist.filter((item) => !item.completed);

  let label = 'Perfil inicial';
  if (score >= 80) label = 'Perfil completo';
  else if (score >= 65) label = 'Perfil forte';
  else if (score >= 45) label = 'Em desenvolvimento';

  return {
    score,
    label,
    totalItems: checklist.length,
    completedCount,
    missingCount: missingItems.length,
    isProfileComplete: score >= 80 && missingCriticalItems.length === 0,
    checklist,
    missingItems,
    nextSteps: missingItems.slice(0, 4),
  };
}

export function buildCandidateSignals(userData = {}, profileData = {}) {
  const completion = calculateCandidateProfileCompletion(userData, profileData);
  const skillsRaw = getCandidateSkills(userData, profileData);

  return {
    skills: skillsRaw.map((skill) => normalizeText(skill)).filter(Boolean),
    skillsRaw,
    area: normalizeText(
      profileData.objectiveArea || userData.objectiveArea || '',
    ),
    areaRaw: profileData.objectiveArea || userData.objectiveArea || '',
    location: normalizeText(getCandidateLocation(userData, profileData)),
    locationRaw: getCandidateLocation(userData, profileData),
    objectiveType: normalizeText(
      profileData.objectiveType || userData.objectiveType || '',
    ),
    objectiveTypeRaw: profileData.objectiveType || userData.objectiveType || '',
    completion,
  };
}

export function buildCandidateVisibility(userData = {}, profileData = {}) {
  const planSummary = getPlanSummary(userData);
  const completion = calculateCandidateProfileCompletion(userData, profileData);
  const verification = getCandidateVerification(userData, profileData);
  const verified = verification.paid || verification.qualified;
  // F2.1/K1: nenhum destaque nem prioridade pagos. Campos legados
  // (`destaque`, `curriculoDestacado`) ficam nos documentos mas não contam.
  const highlighted = false;
  const availableForWork = getCandidateAvailableForWork(userData, profileData);
  const hasCv = hasValue(getCandidateCvUrl(userData, profileData));

  let visibilityScore = completion.score;
  if (completion.isProfileComplete) visibilityScore += 18;
  if (verified) visibilityScore += 15;
  if (availableForWork) visibilityScore += 6;
  if (hasCv) visibilityScore += 4;

  return {
    planId: planSummary.planId,
    priorityInSearch: false,
    highlighted,
    verified,
    verificationTypes: verification.types,
    verificationType: verification.primaryType,
    paidVerified: verification.paid,
    premiumVerified: verification.premiumVerified,
    qualifiedVerified: verification.qualified,
    qualificationScore: verification.qualificationScore,
    qualificationLabel: verification.qualificationLabel,
    hasCv,
    availableForWork,
    completionScore: completion.score,
    completionLabel: completion.label,
    isProfileComplete: completion.isProfileComplete,
    visibilityScore,
    createdAtMillis: getDateMillis(
      userData.updatedAt ||
        profileData.updatedAt ||
        userData.createdAt ||
        profileData.createdAt,
    ),
  };
}

export function compareCandidatesByVisibility(a = {}, b = {}) {
  const scoreA = Number(a.visibilityScore || 0);
  const scoreB = Number(b.visibilityScore || 0);
  if (scoreA !== scoreB) return scoreB - scoreA;

  const dateA = Number(a.createdAtMillis || 0);
  const dateB = Number(b.createdAtMillis || 0);
  return dateB - dateA;
}

function serializeJobTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export function scoreJobForCandidate(
  job = {},
  userData = {},
  profileData = {},
) {
  const planSummary = getPlanSummary(userData);
  const signals = buildCandidateSignals(userData, profileData);
  const visibility = buildCandidateVisibility(userData, profileData);

  const text = normalizeText(
    [
      job.titulo,
      job.title,
      job.descricao,
      job.description,
      job.requisitos,
      job.requirements,
      job.localizacao,
      job.location,
      job.tipoContrato,
      job.contractType,
      job.empresa,
      job.empresaNome,
      job.categoria,
      ...(Array.isArray(job.palavrasChave) ? job.palavrasChave : []),
    ]
      .filter(Boolean)
      .join(' '),
  );

  let score = 0;
  const reasons = [];

  const matchedSkills = signals.skillsRaw
    .filter((skill) => {
      const normalizedSkill = normalizeText(skill);
      return normalizedSkill && text.includes(normalizedSkill);
    })
    .slice(0, 3);

  if (matchedSkills.length) {
    score += matchedSkills.length * 18;
    reasons.push(`Compatível com ${matchedSkills.join(', ')}`);
  }

  if (signals.area && text.includes(signals.area)) {
    score += 24;
    reasons.push(`Alinhada com a sua área: ${signals.areaRaw}`);
  }

  const jobLocation = normalizeText(job.localizacao || job.location || '');
  if (job.remoto) {
    score += 12;
    reasons.push('Aceita trabalho remoto');
  } else if (
    signals.location &&
    jobLocation &&
    (jobLocation.includes(signals.location) ||
      signals.location.includes(jobLocation))
  ) {
    score += 14;
    reasons.push(`Localização compatível: ${job.localizacao || job.location}`);
  }

  const contractType = normalizeText(
    job.tipoContrato || job.contractType || '',
  );
  if (
    signals.objectiveType &&
    contractType &&
    contractType.includes(signals.objectiveType)
  ) {
    score += 10;
    reasons.push(
      `Tipo de contrato alinhado: ${job.tipoContrato || job.contractType}`,
    );
  }

  const createdAt = serializeJobTimestamp(job.createdAt);
  if (createdAt) {
    const ageInDays = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (ageInDays <= 14) {
      score += 6;
      reasons.push('Vaga publicada recentemente');
    }
  }

  if (job.destaque === true && planSummary.features?.canApplyToFeaturedJobs) {
    score += 6;
    reasons.push('O seu plano permite candidatar-se a vagas em destaque');
  }

  if (planSummary.features?.canReceivePersonalizedJobs) {
    score += 6;
  }

  if (visibility.priorityInSearch) {
    score += 4;
  }

  if (signals.completion.isProfileComplete) {
    score += 6;
  } else if (signals.completion.score >= 65) {
    score += 3;
  }

  if (!reasons.length) {
    reasons.push('Compatibilidade geral com o seu perfil');
  }

  return {
    score,
    reasons: reasons.slice(0, 4),
    matchedSkills,
    signals,
    visibility,
    planSummary,
  };
}

export function shouldNotifyCandidateForJob(
  job = {},
  userData = {},
  profileData = {},
  options = {},
) {
  const minScore = Number(options.minScore) || 28;
  const scored = scoreJobForCandidate(job, userData, profileData);
  const hasStrongSignal =
    scored.matchedSkills.length > 0 ||
    scored.reasons.some((reason) =>
      /área|localização|contrato|remoto/i.test(reason),
    );

  return {
    ...scored,
    shouldNotify: scored.score >= minScore && hasStrongSignal,
  };
}
