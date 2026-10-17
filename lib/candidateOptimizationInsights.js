import {
  buildCandidateSignals,
  buildCandidateVisibility,
  calculateCandidateProfileCompletion,
  scoreJobForCandidate,
} from './candidateProfileInsights';

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'por', 'sem', 'ser', 'um', 'uma', 'que', 'se', 'sua', 'seu', 'suo', 'mais', 'menos',
  'sobre', 'trabalho', 'vaga', 'funcao', 'funcao', 'cargo', 'empresa', 'perfil', 'profissional', 'experiencia',
  'area', 'setor', 'nivel', 'anos', 'ano', 'jornada', 'contrato', 'regime', 'ativo', 'ativa', 'candidato',
]);

const GENERIC_PHRASES = new Set([
  'boa comunicacao',
  'comunicacao',
  'responsabilidade',
  'pontualidade',
  'organizacao',
  'trabalho em equipa',
  'proatividade',
  'disponibilidade',
  'experiencia comprovada',
  'experiencia anterior',
  'tempo integral',
  'full time',
  'part time',
]);

function sanitizeText(value = '') {
  return String(value || '').trim();
}

function normalizeText(value = '') {
  return sanitizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasValue(value) {
  return sanitizeText(value).length > 0;
}

function uniqueList(values = []) {
  const seen = new Set();
  return values.flatMap((item) => {
    const text = sanitizeText(item);
    const key = normalizeText(text);
    if (!text || !key || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeText(item)).filter(Boolean);
  }

  if (!value) return [];

  if (typeof value === 'object') {
    return Object.values(value).map((item) => sanitizeText(item)).filter(Boolean);
  }

  return String(value)
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitPhrases(value) {
  if (!value) return [];

  const rawValue = Array.isArray(value) ? value.join('\n') : String(value);
  return rawValue
    .split(/\n|,|;|\/|\||•/g)
    .map((item) => sanitizeText(item))
    .filter(Boolean);
}

function tokenizeText(value = '') {
  return normalizeText(value)
    .split(/[^a-z0-9+#.]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function phraseLooksUseful(value = '') {
  const text = sanitizeText(value);
  if (!text || text.length < 2 || text.length > 60) return false;

  const normalized = normalizeText(text);
  if (GENERIC_PHRASES.has(normalized)) return false;

  const tokens = tokenizeText(text);
  return tokens.length > 0;
}

function phrasesOverlap(a = '', b = '') {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  if (!normalizedA || !normalizedB) return false;
  return normalizedA === normalizedB || normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

function getCandidateHeadline(userData = {}, profileData = {}) {
  return sanitizeText(profileData.headline || profileData.profession || userData.headline || userData.profession);
}

function getCandidateObjective(userData = {}, profileData = {}) {
  return sanitizeText(profileData.objectiveArea || profileData.objectiveAspiration || userData.objectiveArea);
}

function getCandidateLocation(userData = {}, profileData = {}) {
  return sanitizeText(profileData.city || profileData.location || userData.location || userData.localizacao);
}

function getCandidateCv(userData = {}, profileData = {}) {
  return sanitizeText(profileData.cvUrl || userData.cvUrl);
}

function getCandidateBio(userData = {}, profileData = {}) {
  return sanitizeText(profileData.bio || userData.bio || userData.sobre);
}

function getCandidateEducation(userData = {}, profileData = {}) {
  return sanitizeText(profileData.education || userData.education);
}

function getCandidateLanguages(userData = {}, profileData = {}) {
  return toArray(profileData.languages || userData.languages);
}

function getCandidateCertificates(userData = {}, profileData = {}) {
  const files = Array.isArray(profileData.certificateFiles) ? profileData.certificateFiles.filter(Boolean) : [];
  const descriptions = toArray(profileData.certifications || userData.certifications);
  return {
    fileCount: files.length,
    descriptions,
  };
}

function getCandidateExperienceEntries(userData = {}, profileData = {}) {
  const entries = [
    ...(Array.isArray(profileData.experience) ? profileData.experience : []),
    ...(Array.isArray(userData.experience) ? userData.experience : []),
  ];

  return entries.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return Object.values(entry).some((value) => hasValue(value));
  });
}

function getCandidateSearchKeywords(userData = {}, profileData = {}) {
  const signals = buildCandidateSignals(userData, profileData);
  return uniqueList([
    getCandidateHeadline(userData, profileData),
    getCandidateObjective(userData, profileData),
    signals.areaRaw,
    signals.objectiveTypeRaw,
    ...signals.skillsRaw,
    getCandidateLocation(userData, profileData),
  ]).filter(phraseLooksUseful).slice(0, 12);
}

function normalizeKeywordCandidates(values = []) {
  return uniqueList(
    uniqueList(values)
    .flatMap((item) => {
      const text = sanitizeText(item);
      if (!text) return [];
      const direct = phraseLooksUseful(text) ? [text] : [];
      const expanded = splitPhrases(text).filter(phraseLooksUseful);
      return [...direct, ...expanded];
    })
    .filter(phraseLooksUseful),
  );
}

export function extractJobKeywords(job = {}) {
  const rawKeywords = normalizeKeywordCandidates([
    ...(Array.isArray(job.palavrasChave) ? job.palavrasChave : []),
    ...(Array.isArray(job.keywords) ? job.keywords : []),
    ...(Array.isArray(job.skills) ? job.skills : []),
    ...(Array.isArray(job.skillsRequired) ? job.skillsRequired : []),
    job.categoria,
    job.area,
    job.setor,
    job.department,
    job.nivelExperiencia,
    job.experiencia,
    ...splitPhrases(job.requisitos || job.requirements),
  ]);

  return rawKeywords.slice(0, 14);
}

function deriveMissingKeywords(jobKeywords = [], candidateKeywords = []) {
  return jobKeywords
    .filter((keyword) => !candidateKeywords.some((candidateKeyword) => phrasesOverlap(keyword, candidateKeyword)))
    .slice(0, 6);
}

function buildProfessionalSummarySuggestion(userData = {}, profileData = {}) {
  const headline = getCandidateHeadline(userData, profileData);
  const objective = getCandidateObjective(userData, profileData);
  const location = getCandidateLocation(userData, profileData);
  const skills = buildCandidateSignals(userData, profileData).skillsRaw.slice(0, 4);
  const experienceCount = getCandidateExperienceEntries(userData, profileData).length;

  const parts = [];
  if (headline) {
    parts.push(`Profissional com foco em ${headline}`);
  } else if (objective) {
    parts.push(`Candidato orientado para oportunidades em ${objective}`);
  } else {
    parts.push('Profissional motivado para novas oportunidades');
  }

  if (skills.length > 0) {
    parts.push(`com destaque para ${skills.join(', ')}`);
  }

  if (experienceCount > 0) {
    parts.push(`e experiencia pratica em ${experienceCount} contexto(s) profissional(is)`);
  }

  if (location) {
    parts.push(`baseado em ${location}`);
  }

  const firstSentence = `${parts.join(' ')}.`;
  const secondSentence = objective
    ? `Procura uma funcao alinhada com ${objective}, com impacto claro e evolucao profissional.`
    : 'Procura uma funcao onde possa contribuir com consistencia, aprendizagem rapida e foco em resultados.';

  return `${firstSentence} ${secondSentence}`.replace(/\s+/g, ' ').trim();
}

function buildStrengths(userData = {}, profileData = {}, topMatches = []) {
  const completion = calculateCandidateProfileCompletion(userData, profileData);
  const visibility = buildCandidateVisibility(userData, profileData);
  const skills = buildCandidateSignals(userData, profileData).skillsRaw;
  const experienceEntries = getCandidateExperienceEntries(userData, profileData);
  const strengths = [];

  if (completion.isProfileComplete) strengths.push('Perfil completo e pronto para triagem');
  if (visibility.verified) strengths.push('Perfil verificado com maior confianca');
  if (skills.length >= 5) strengths.push(`Base consistente de competencias: ${skills.slice(0, 3).join(', ')}`);
  if (experienceEntries.length > 0) strengths.push(`Historico profissional preenchido com ${experienceEntries.length} experiencia(s)`);
  if (hasValue(getCandidateCv(userData, profileData))) strengths.push('CV atualizado anexado ao perfil');
  if (topMatches[0]?.matchPercent >= 70) strengths.push(`Boa aderencia ao mercado atual (${topMatches[0].matchPercent}% na melhor vaga)`);

  return uniqueList(strengths).slice(0, 5);
}

function buildImprovementActions(userData = {}, profileData = {}, marketSkillGaps = []) {
  const completion = calculateCandidateProfileCompletion(userData, profileData);
  const skills = buildCandidateSignals(userData, profileData).skillsRaw;
  const actions = [];

  if (!completion.isProfileComplete) {
    const nextStep = completion.nextSteps?.[0];
    actions.push({
      id: 'complete-profile',
      title: 'Completar o perfil principal',
      detail: nextStep?.hint || 'Feche os blocos criticos do perfil para subir na triagem.',
      impact: 'alto',
    });
  }

  if (!hasValue(getCandidateBio(userData, profileData))) {
    actions.push({
      id: 'improve-summary',
      title: 'Escrever um resumo profissional objetivo',
      detail: 'Um resumo claro ajuda empresas e matching a identificar melhor o seu valor.',
      impact: 'alto',
    });
  }

  if (!hasValue(getCandidateCv(userData, profileData))) {
    actions.push({
      id: 'upload-cv',
      title: 'Anexar um CV atualizado',
      detail: 'Sem CV, perde forca na triagem e na compatibilidade com vagas.',
      impact: 'alto',
    });
  }

  if (skills.length < 5) {
    actions.push({
      id: 'expand-skills',
      title: 'Adicionar mais competencias pesquisaveis',
      detail: 'Perfis com pelo menos 5 competencias aparecem com mais contexto nas buscas.',
      impact: 'medio',
    });
  }

  if (!hasValue(profileData.linkedin) && !hasValue(profileData.website)) {
    actions.push({
      id: 'add-proof-links',
      title: 'Adicionar LinkedIn ou portfolio',
      detail: 'Links externos funcionam como prova adicional de experiencia e resultados.',
      impact: 'medio',
    });
  }

  if (marketSkillGaps.length > 0) {
    actions.push({
      id: 'close-market-gaps',
      title: 'Cobrir lacunas frequentes do mercado',
      detail: `Considere reforcar evidencias para ${marketSkillGaps.slice(0, 3).join(', ')}.`,
      impact: 'medio',
    });
  }

  return actions.slice(0, 5);
}

function getEmployabilityLabel(score) {
  if (score >= 85) return 'Excelente prontidao';
  if (score >= 70) return 'Perfil competitivo';
  if (score >= 55) return 'Boa base com margem';
  if (score >= 40) return 'Em evolucao';
  return 'Perfil inicial';
}

function getMatchLabel(score) {
  if (score >= 80) return 'Muito forte';
  if (score >= 65) return 'Boa compatibilidade';
  if (score >= 45) return 'Compatibilidade moderada';
  return 'Compatibilidade baixa';
}

export function analyzeCandidateJobFit(job = {}, userData = {}, profileData = {}) {
  const scored = scoreJobForCandidate(job, userData, profileData);
  const completion = scored.signals?.completion || calculateCandidateProfileCompletion(userData, profileData);
  const candidateKeywords = getCandidateSearchKeywords(userData, profileData);
  const jobKeywords = extractJobKeywords(job);
  const missingSkills = deriveMissingKeywords(jobKeywords, [...candidateKeywords, ...scored.matchedSkills]);

  const reasonsText = normalizeText((scored.reasons || []).join(' '));
  const skillsFit = clamp(scored.matchedSkills.length * 16, 0, 48);
  const areaFit = reasonsText.includes('area') ? 18 : 0;
  const locationFit = reasonsText.includes('localizacao') || reasonsText.includes('remoto') ? 14 : 0;
  const contractFit = reasonsText.includes('contrato') ? 8 : 0;
  const profileReadiness = completion.isProfileComplete ? 16 : clamp(Math.round(completion.score * 0.16), 4, 14);
  // Só a verificação (confiança) conta; nada pago influencia o score (F2.1).
  const visibilityBoost = scored.visibility?.verified ? 4 : 0;

  const matchPercent = clamp(skillsFit + areaFit + locationFit + contractFit + profileReadiness + visibilityBoost, 0, 100);
  const matchLabel = getMatchLabel(matchPercent);

  const cvOptimizationTips = uniqueList([
    scored.matchedSkills.length
      ? `Realce no CV competencias diretamente ligadas a esta vaga: ${scored.matchedSkills.slice(0, 3).join(', ')}.`
      : '',
    missingSkills.length
      ? `Se tiver experiencia com ${missingSkills.slice(0, 3).join(', ')}, inclua isso no CV, no resumo e nas experiencias.`
      : '',
    !completion.isProfileComplete
      ? 'Complete os blocos criticos do perfil para subir a compatibilidade e a confianca da triagem.'
      : '',
    !hasValue(getCandidateBio(userData, profileData))
      ? 'Escreva um resumo profissional curto ligando experiencia, competencias e objetivo da vaga.'
      : '',
    !hasValue(getCandidateCv(userData, profileData))
      ? 'Anexe um CV atualizado antes de se candidatar a vagas com triagem mais exigente.'
      : '',
    hasValue(job.titulo || job.title)
      ? `Ajuste o titulo profissional do perfil para aproximar-se de "${job.titulo || job.title}" quando isso fizer sentido.`
      : '',
  ]).slice(0, 4);

  const feedback =
    matchPercent >= 75
      ? 'O seu perfil ja mostra aderencia forte a esta vaga; vale a pena reforcar provas concretas e candidatar-se com contexto claro.'
      : matchPercent >= 55
        ? 'Ha boa base de compatibilidade, mas pequenos ajustes no perfil e no CV podem aumentar a forca desta candidatura.'
        : 'Esta vaga pode exigir reposicionamento do perfil, mais contexto no CV e reforco das competencias mais pedidas.';

  return {
    matchPercent,
    matchLabel,
    rawScore: Number(scored.score) || 0,
    reasons: Array.isArray(scored.reasons) ? scored.reasons.slice(0, 4) : [],
    matchedSkills: Array.isArray(scored.matchedSkills) ? scored.matchedSkills.slice(0, 6) : [],
    missingSkills,
    candidateKeywords,
    jobKeywords,
    cvOptimizationTips,
    profileReadiness: completion.score,
    feedback,
    visibility: scored.visibility,
    signals: scored.signals,
  };
}

export function buildCandidateOptimizationInsights({ userData = {}, profileData = {}, jobs = [], applications = [] } = {}) {
  const completion = calculateCandidateProfileCompletion(userData, profileData);
  const visibility = buildCandidateVisibility(userData, profileData);
  const candidateKeywords = getCandidateSearchKeywords(userData, profileData);
  const experienceEntries = getCandidateExperienceEntries(userData, profileData);
  const certificates = getCandidateCertificates(userData, profileData);
  const appliedJobIds = new Set(
    (Array.isArray(applications) ? applications : [])
      .map((application) => application?.jobId)
      .filter(Boolean)
  );

  const activeJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => {
    if (!job || typeof job !== 'object') return false;
    const status = normalizeText(job.status || 'active');
    return (!status || status === 'active' || status === 'open') && !appliedJobIds.has(job.id);
  });

  const topMatches = activeJobs
    .map((job) => {
      const analysis = analyzeCandidateJobFit(job, userData, profileData);
      return {
        id: job.id,
        title: job.titulo || job.title || 'Vaga',
        company: job.empresaNome || job.companyName || job.empresa || 'Empresa',
        location: job.localizacao || job.location || '',
        matchPercent: analysis.matchPercent,
        matchLabel: analysis.matchLabel,
        reasons: analysis.reasons,
        matchedSkills: analysis.matchedSkills,
        missingSkills: analysis.missingSkills,
      };
    })
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, 4);

  const averageTopMatch = topMatches.length
    ? Math.round(topMatches.reduce((sum, job) => sum + job.matchPercent, 0) / topMatches.length)
    : 0;

  const marketDemandMap = activeJobs.reduce((accumulator, job) => {
    extractJobKeywords(job).forEach((keyword) => {
      const normalized = normalizeText(keyword);
      if (!normalized) return;
      accumulator[normalized] = {
        label: keyword,
        count: (accumulator[normalized]?.count || 0) + 1,
      };
    });
    return accumulator;
  }, {});

  const marketSkillGaps = Object.values(marketDemandMap)
    .filter((entry) => !candidateKeywords.some((keyword) => phrasesOverlap(keyword, entry.label)))
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.label)
    .slice(0, 6);

  let employabilityScore = Math.round(completion.score * 0.52);
  if (visibility.verified) employabilityScore += 10;
  if (candidateKeywords.length >= 6) employabilityScore += 8;
  if (experienceEntries.length > 0) employabilityScore += Math.min(8, experienceEntries.length * 3);
  if (hasValue(getCandidateCv(userData, profileData))) employabilityScore += 8;
  if (certificates.fileCount > 0 || certificates.descriptions.length > 0) employabilityScore += 6;
  if (hasValue(profileData.linkedin) || hasValue(profileData.website)) employabilityScore += 4;
  if (hasValue(getCandidateEducation(userData, profileData))) employabilityScore += 4;
  if (getCandidateLanguages(userData, profileData).length > 0) employabilityScore += 3;
  if (averageTopMatch > 0) employabilityScore += Math.round(averageTopMatch * 0.15);
  employabilityScore = clamp(employabilityScore, 0, 100);

  const strengths = buildStrengths(userData, profileData, topMatches);
  const improvementActions = buildImprovementActions(userData, profileData, marketSkillGaps);
  const searchKeywords = uniqueList([...candidateKeywords, ...buildCandidateSignals(userData, profileData).skillsRaw]).slice(0, 10);
  const summarySuggestion = buildProfessionalSummarySuggestion(userData, profileData);

  return {
    employabilityScore,
    employabilityLabel: getEmployabilityLabel(employabilityScore),
    averageTopMatch,
    bestMatchScore: topMatches[0]?.matchPercent || 0,
    summarySuggestion,
    strengths,
    improvementActions,
    marketSkillGaps,
    searchKeywords,
    topMatches,
    activeJobsAnalyzed: activeJobs.length,
    profileReadiness: completion,
    visibility,
  };
}
