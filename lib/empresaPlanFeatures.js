/**
 * Sistema de Recursos e Limites por Plano - Empresas
 * 
 * Define os recursos disponiveis para cada plano de empresa
 * e funcoes para verificar limites e permissoes
 */

import { isJobExpired } from './jobExpiration';

// Configuracao de recursos por plano
export const EMPRESA_PLAN_FEATURES = {
  basic_empresa: {
    name: 'Básico',
    price: 0,
    priceLabel: 'Gratis',
    // Limites
    maxActiveJobs: 1, // Apenas 1 vaga ativa por vez
    maxApplicationsPerJob: 10, // Maximo 10 candidaturas por vaga
    canHighlightJobs: false, // NAO pode destacar vagas
    canViewCandidateContact: false, // NAO pode ver contato do candidato
    canExportApplications: false, // NAO pode exportar candidaturas
    canUseAdvancedFilters: false, // NAO pode usar filtros avancados
    canAccessAnalytics: false, // NAO pode acessar analytics
    canSendDirectMessages: false, // NAO pode enviar mensagens diretas
    canScheduleInterviews: false, // NAO pode agendar entrevistas pelo sistema
    canUseMessageTemplates: false, // NAO pode usar templates de mensagens
    canViewCandidateCV: true, // Pode ver CV do candidato
    jobDurationDays: 15, // Vaga expira em 15 dias
    supportLevel: 'basic', // Suporte basico
    companyVerified: false, // Empresa nao verificada
    logoOnJob: false, // Logo nao aparece na vaga
    priorityInSearch: false, // Sem prioridade nas buscas
    accessTalentPool: false,
  },
  professional_empresa: {
    name: 'Profissional',
    price: 100,
    priceLabel: '100 Dobras/mes',
    // Limites
    maxActiveJobs: 5, // Ate 5 vagas ativas
    maxApplicationsPerJob: 50, // Ate 50 candidaturas por vaga
    canHighlightJobs: true, // Pode destacar 1 vaga
    maxHighlightedJobs: 1,
    canViewCandidateContact: true, // Pode ver contato do candidato
    canExportApplications: true, // Pode exportar candidaturas
    canUseAdvancedFilters: true, // Pode usar filtros avancados
    canAccessAnalytics: false, // NAO pode acessar analytics completos
    canSendDirectMessages: false, // Nao pode enviar mensagens diretas
    canScheduleInterviews: true, // Pode agendar entrevistas
    canUseMessageTemplates: true, // Pode usar templates de mensagens
    canViewCandidateCV: true, // Pode ver CV
    jobDurationDays: 30, // Vaga dura 30 dias
    supportLevel: 'priority', // Suporte prioritario
    companyVerified: true, // Empresa verificada
    logoOnJob: true, // Logo aparece na vaga
    priorityInSearch: true, // Prioridade nas buscas
    accessTalentPool: false,
  },
  unlimited_empresa: {
    name: 'PRO',
    price: 2000,
    priceLabel: '2000 Dobras/mes',
    // Limites
    maxActiveJobs: null, // Ilimitado
    maxApplicationsPerJob: null, // Ilimitado
    canHighlightJobs: true, // Pode destacar vagas
    maxHighlightedJobs: null, // Destaques ilimitados
    canViewCandidateContact: true, // Pode ver contato
    canExportApplications: true, // Pode exportar
    canUseAdvancedFilters: true, // Filtros avancados
    canAccessAnalytics: true, // Analytics completos
    canSendDirectMessages: true, // Mensagens diretas
    canScheduleInterviews: true, // Agendar entrevistas
    canUseMessageTemplates: true, // Templates ilimitados
    canViewCandidateCV: true, // Ver CV
    jobDurationDays: 60, // Vaga dura 60 dias
    supportLevel: 'vip', // Suporte VIP
    companyVerified: true, // Empresa verificada
    logoOnJob: true, // Logo na vaga
    priorityInSearch: true, // Maxima prioridade
    featuredCompany: true, // Empresa em destaque na plataforma
    accessTalentPool: true, // Acesso ao banco de talentos
  }
};

/**
 * Resolve um plano de empresa para um tier conhecido do sistema.
 * Isto evita cair no plano básico quando o plano aprovado é personalizado.
 */
export function normalizeEmpresaPlanId(planId, planName = '', metadata = {}) {
  const normalizedId = String(planId || '').toLowerCase().trim();
  if (EMPRESA_PLAN_FEATURES[normalizedId]) {
    return normalizedId;
  }

  const normalizedName = String(planName || '').toLowerCase();
  if (normalizedName === 'pro' || normalizedName === 'plano pro') {
    return 'unlimited_empresa';
  }
  if (
    normalizedName.includes('unlimited') ||
    normalizedName.includes('ilimit') ||
    normalizedName.includes('premium') ||
    normalizedName.includes('vip')
  ) {
    return 'unlimited_empresa';
  }
  if (
    normalizedName.includes('professional') ||
    normalizedName.includes('profissional') ||
    normalizedName.includes('pro')
  ) {
    return 'professional_empresa';
  }
  if (
    normalizedName.includes('basic') ||
    normalizedName.includes('basico') ||
    normalizedName.includes('básico') ||
    normalizedName.includes('gratis') ||
    normalizedName.includes('gratuit')
  ) {
    return 'basic_empresa';
  }

  const vagasLimit = metadata?.vagasLimit;
  const destaque = metadata?.destaque;
  const maxActiveJobs = metadata?.maxActiveJobs;
  const accessTalentPool = metadata?.accessTalentPool;
  const canAccessAnalytics = metadata?.canAccessAnalytics;

  const hasUnlimitedEntitlements =
    vagasLimit === null ||
    maxActiveJobs === null ||
    accessTalentPool === true ||
    canAccessAnalytics === true;
  if (hasUnlimitedEntitlements) {
    return 'unlimited_empresa';
  }

  const numericLimit = Number(vagasLimit ?? maxActiveJobs);
  if ((Number.isFinite(numericLimit) && numericLimit > 1) || destaque === true) {
    return 'professional_empresa';
  }

  return 'basic_empresa';
}

/**
 * Obtem os recursos do plano da empresa
 */
export function getEmpresaPlanFeatures(planId, planName = '', metadata = {}) {
  const normalizedPlanId = normalizeEmpresaPlanId(planId, planName, metadata);
  return EMPRESA_PLAN_FEATURES[normalizedPlanId] || EMPRESA_PLAN_FEATURES.basic_empresa;
}

/**
 * Verifica se a empresa pode criar uma nova vaga
 */
export async function canCreateJob(companyId, planId, admin) {
  const features = getEmpresaPlanFeatures(planId);
  
  // Plano premium tem vagas ilimitadas
  if (features.maxActiveJobs === null) {
    return { allowed: true };
  }

  // Contar vagas ativas
  const activeJobsSnapshot = await admin.firestore()
    .collection('jobs')
    .where('companyId', '==', companyId)
    .where('status', '==', 'active')
    .get();

  const count = activeJobsSnapshot.docs.filter((doc) => !isJobExpired(doc.data())).length;
  const limit = features.maxActiveJobs;

  if (count >= limit) {
    return {
      allowed: false,
      reason: `Voce atingiu o limite de ${limit} vaga(s) ativa(s) do plano ${features.name}.`,
      current: count,
      limit: limit,
      code: 'JOB_LIMIT_REACHED',
      upgradeMessage: 'Faca upgrade para o plano Profissional ou PRO para publicar mais vagas!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return {
    allowed: true,
    remaining: limit - count,
    limit: limit
  };
}

/**
 * Verifica se a empresa pode destacar uma vaga
 */
export async function canHighlightJob(companyId, planId, admin) {
  const features = getEmpresaPlanFeatures(planId);
  
  if (!features.canHighlightJobs) {
    return {
      allowed: false,
      reason: 'Destacar vagas é um recurso exclusivo dos planos Profissional e PRO.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para destacar suas vagas e atrair mais candidatos!',
      upgradeUrl: '/premium/empresa'
    };
  }

  // Plano premium tem destaques ilimitados
  if (features.maxHighlightedJobs === null) {
    return { allowed: true };
  }

  // Contar vagas destacadas ativas
  const highlightedJobsSnapshot = await admin.firestore()
    .collection('jobs')
    .where('companyId', '==', companyId)
    .where('status', '==', 'active')
    .where('destaque', '==', true)
    .get();

  const count = highlightedJobsSnapshot.docs.filter((doc) => !isJobExpired(doc.data())).length;
  const limit = features.maxHighlightedJobs;

  if (count >= limit) {
    return {
      allowed: false,
      reason: `Voce atingiu o limite de ${limit} vaga(s) em destaque do plano ${features.name}.`,
      current: count,
      limit: limit,
      code: 'HIGHLIGHT_LIMIT_REACHED',
      upgradeMessage: 'Faca upgrade para o plano PRO para destaques ilimitados!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return {
    allowed: true,
    remaining: limit - count,
    limit: limit
  };
}

/**
 * Verifica se a empresa pode ver o contato do candidato
 */
export function canViewCandidateContact(planId) {
  const features = getEmpresaPlanFeatures(planId);
  
  if (!features.canViewCandidateContact) {
    return {
      allowed: false,
      reason: 'Ver contato do candidato é um recurso exclusivo dos planos Profissional e PRO.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para ver o contato dos candidatos!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se a empresa pode enviar mensagem direta ao candidato
 */
export function canSendDirectMessage(planId) {
  const features = getEmpresaPlanFeatures(planId);
  
  if (!features.canSendDirectMessages) {
    return {
      allowed: false,
      reason: 'Enviar mensagens diretas aos candidatos é um recurso exclusivo do plano PRO.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para o plano PRO para entrar em contato direto com os candidatos!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se a empresa pode agendar entrevistas pelo sistema
 */
export function canScheduleInterview(planId) {
  const features = getEmpresaPlanFeatures(planId);
  
  if (!features.canScheduleInterviews) {
    return {
      allowed: false,
      reason: 'Agendar entrevistas pelo sistema é um recurso exclusivo dos planos Profissional e PRO.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para organizar suas entrevistas diretamente na plataforma!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se a empresa pode usar templates de mensagens
 */
export function canUseMessageTemplates(planId) {
  const features = getEmpresaPlanFeatures(planId);
  
  if (!features.canUseMessageTemplates) {
    return {
      allowed: false,
      reason: 'Templates de mensagens são um recurso exclusivo dos planos Profissional e PRO.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para ganhar tempo com modelos de mensagens personalizados!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se a empresa pode acessar analytics
 */
export function canAccessAnalytics(planId) {
  const features = getEmpresaPlanFeatures(planId);
  
  if (!features.canAccessAnalytics) {
    return {
      allowed: false,
      reason: 'Analytics completos é um recurso exclusivo do plano PRO.',
      code: 'FEATURE_PREMIUM_ONLY',
      upgradeMessage: 'Faça upgrade para o plano PRO para acessar analytics completos!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se a empresa pode exportar candidaturas
 */
export function canExportApplications(planId) {
  const features = getEmpresaPlanFeatures(planId);
  
  if (!features.canExportApplications) {
    return {
      allowed: false,
      reason: 'Exportar candidaturas é um recurso exclusivo dos planos Profissional e PRO.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para exportar candidaturas!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se a empresa pode aceder ao banco de talentos
 */
export function canAccessTalentPool(planId) {
  const features = getEmpresaPlanFeatures(planId);

  if (!features.accessTalentPool) {
    return {
      allowed: false,
      reason: 'O Banco de Talentos é exclusivo do plano PRO.',
      code: 'TALENT_POOL_RESTRICTED',
      upgradeMessage: 'Faça upgrade para o plano PRO e aceda ao banco de talentos!',
      upgradeUrl: '/premium/empresa'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se o plano esta ativo (nao expirado)
 */
export function isPlanActive(planEndDate) {
  if (!planEndDate || planEndDate === null) {
    return true; // Plano ilimitado esta sempre ativo
  }
  
  try {
    const endDate = planEndDate.toDate ? planEndDate.toDate() : new Date(planEndDate);
    return endDate > new Date();
  } catch (error) {
    console.error('Erro ao verificar data de termino do plano:', error);
    return false;
  }
}

/**
 * Obtem informacoes resumidas do plano da empresa
 */
export function getEmpresaPlanSummary(userData) {
  const rawPlanId = userData.planTierId || userData.currentPlan || userData.planId || 'basic_empresa';
  let planId = normalizeEmpresaPlanId(rawPlanId, userData.planName, userData);
  
  // Verificar se plano esta ativo
  if (planId !== 'basic_empresa') {
    const isActive = isPlanActive(userData.planEndDate);
    if (!isActive && userData.planEndDate !== null) {
      planId = 'basic_empresa';
    }
  }
  
  const features = getEmpresaPlanFeatures(planId, userData.planName, userData);
  const isActive = planId === 'basic_empresa' ? true : isPlanActive(userData.planEndDate);
  
  let daysRemaining = null;
  if (planId !== 'basic_empresa' && userData.planEndDate) {
    try {
      const endDate = userData.planEndDate.toDate ? userData.planEndDate.toDate() : new Date(userData.planEndDate);
      const diff = endDate.getTime() - new Date().getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    } catch (error) {
      daysRemaining = null;
    }
  }
  
  return {
    planId,
    rawPlanId,
    planName: userData.planName || features.name,
    price: features.price,
    priceLabel: features.priceLabel,
    isActive: isActive,
    features,
    daysRemaining: daysRemaining
  };
}

/**
 * Calcula a data de expiracao da vaga baseado no plano
 */
export function getJobExpirationDate(planId) {
  const features = getEmpresaPlanFeatures(planId);
  const now = new Date();
  const expirationDate = new Date(now.getTime() + (features.jobDurationDays * 24 * 60 * 60 * 1000));
  return expirationDate;
}
