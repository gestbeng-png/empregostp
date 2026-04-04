/**
 * Sistema de Recursos e Limites por Plano - Candidatos
 * 
 * Define os recursos disponíveis para cada plano de candidato
 * e funções para verificar limites e permissões
 */

// Configuração de recursos por plano
export const PLAN_FEATURES = {
  basic_candidato: {
    name: 'Básico',
    price: 0,
    // Limites - APENAS 3 CANDIDATURAS GRATUITAS
    maxApplicationsPerMonth: 3, // Máximo 3 candidaturas por mês (único recurso free)
    canSaveJobs: false, // NÃO pode salvar vagas favoritas (recurso PRO)
    maxSavedJobs: 0, // Não pode salvar vagas
    curriculoDestacado: false, // Currículo não aparece em destaque
    priorityInSearch: false, // Não tem prioridade nas buscas
    canViewStats: false, // Não pode ver estatísticas de visualização
    canReceiveNotifications: false, // NÃO recebe notificações personalizadas (recurso PRO)
    canReceivePersonalizedJobs: false, // NÃO recebe vagas personalizadas (recurso PRO)
    canReceiveRecommendations: false, // NÃO recebe recomendações (recurso PRO)
    canSeeWhoViewedProfile: false, // NÃO pode ver quem visualizou perfil (recurso PRO)
    canApplyToFeaturedJobs: false, // Não pode se candidatar a vagas em destaque
    canVerifyProfile: false, // Não pode verificar perfil (recurso PRO)
    supportLevel: 'basic', // Suporte básico
    canUploadCV: true, // Pode fazer upload de CV
    canUploadCertificates: false, // Não pode fazer upload de certificados
    maxCertificates: 0,
    canUseCvGenerator: false,
  },
  verification_candidato: {
    name: 'Verificação',
    price: 20,
    // Limites (mantém o plano básico, mas libera verificação)
    maxApplicationsPerMonth: 3,
    canSaveJobs: false,
    maxSavedJobs: 0,
    curriculoDestacado: false,
    priorityInSearch: false,
    canViewStats: false,
    canReceiveNotifications: false,
    canReceivePersonalizedJobs: false,
    canReceiveRecommendations: false,
    canSeeWhoViewedProfile: false,
    canApplyToFeaturedJobs: false,
    canVerifyProfile: true,
    supportLevel: 'basic',
    canUploadCV: true,
    canUploadCertificates: false,
    maxCertificates: 0,
    canUseCvGenerator: false,
  },
  professional_candidato: {
    name: 'Profissional',
    price: 50,
    // Limites
    maxApplicationsPerMonth: 20, // Máximo 20 candidaturas por mês
    canSaveJobs: true,
    maxSavedJobs: 50, // Máximo 50 vagas salvas
    curriculoDestacado: true, // Currículo aparece em destaque
    priorityInSearch: true, // Tem prioridade nas buscas
    canViewStats: false,
    canReceiveNotifications: true, // Recebe notificações personalizadas
    canReceivePersonalizedJobs: true, // Recebe vagas personalizadas
    canReceiveRecommendations: true, // Recebe recomendações
    canSeeWhoViewedProfile: false, // Não pode ver quem visualizou (apenas Premium)
    canApplyToFeaturedJobs: true, // Pode se candidatar a vagas em destaque
    canVerifyProfile: false, // Verificacao é tratada em plano proprio
    supportLevel: 'priority', // Suporte prioritário
    canUploadCV: true,
    canUploadCertificates: true,
    maxCertificates: 5, // Máximo 5 certificados
    canUseCvGenerator: true,
  },
  unlimited_candidato: {
    name: 'Premium',
    price: 200,
    // Limites
    maxApplicationsPerMonth: null, // Ilimitado
    canSaveJobs: true,
    maxSavedJobs: null, // Ilimitado
    curriculoDestacado: true, // Currículo super destacado
    priorityInSearch: true, // Máxima prioridade (primeira posição)
    canViewStats: true, // Pode ver estatísticas detalhadas
    canReceiveNotifications: true, // Recebe todas as notificações
    canReceivePersonalizedJobs: true, // Recebe vagas personalizadas
    canReceiveRecommendations: true, // Recebe recomendações avançadas
    canSeeWhoViewedProfile: true, // Pode ver quem visualizou perfil
    canApplyToFeaturedJobs: true,
    canVerifyProfile: false, // Verificacao é tratada em plano proprio
    supportLevel: 'vip', // Suporte VIP
    canUploadCV: true,
    canUploadCertificates: true,
    maxCertificates: null, // Ilimitado
    canUseCvGenerator: true,
  }
};

export function normalizeCandidatePlanId(planId, planName = '', metadata = {}) {
  const normalizedId = String(planId || '').toLowerCase().trim();
  if (PLAN_FEATURES[normalizedId]) {
    return normalizedId;
  }

  const normalizedName = String(planName || '').toLowerCase().trim();
  if (normalizedName.includes('verifica')) return 'verification_candidato';
  if (normalizedName.includes('profissional') || normalizedName.includes('professional') || normalizedName === 'pro') {
    return 'professional_candidato';
  }
  if (normalizedName.includes('premium') || normalizedName.includes('ilimit') || normalizedName.includes('vip')) {
    return 'unlimited_candidato';
  }
  if (
    normalizedName.includes('basico') ||
    normalizedName.includes('básico') ||
    normalizedName.includes('gratis') ||
    normalizedName.includes('gratuit')
  ) {
    return 'basic_candidato';
  }

  const maxApplicationsPerMonth = metadata?.maxApplicationsPerMonth;
  const canUseCvGenerator = metadata?.canUseCvGenerator;
  const canSeeWhoViewedProfile = metadata?.canSeeWhoViewedProfile;
  const canVerifyProfile = metadata?.canVerifyProfile;

  if (canVerifyProfile === true) return 'verification_candidato';
  if (
    maxApplicationsPerMonth === null ||
    canSeeWhoViewedProfile === true
  ) {
    return 'unlimited_candidato';
  }
  if (
    (Number.isFinite(Number(maxApplicationsPerMonth)) && Number(maxApplicationsPerMonth) > 3) ||
    canUseCvGenerator === true
  ) {
    return 'professional_candidato';
  }

  return 'basic_candidato';
}

/**
 * Obtém os recursos do plano do candidato
 */
export function getCandidatePlanFeatures(planId, planName = '', metadata = {}) {
  const normalizedPlanId = normalizeCandidatePlanId(planId, planName, metadata);
  return PLAN_FEATURES[normalizedPlanId] || PLAN_FEATURES.basic_candidato;
}

/**
 * Verifica se o candidato pode fazer uma nova candidatura
 */
export async function canApplyToJob(candidateId, planId, admin) {
  const features = getCandidatePlanFeatures(planId);
  
  // Plano premium tem candidaturas ilimitadas
  if (features.maxApplicationsPerMonth === null) {
    return { allowed: true };
  }

  // Verificar candidaturas do mês atual
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthTimestamp = admin.firestore.Timestamp.fromDate(startOfMonth);

  let count = 0;
  
  try {
    // Tentar usar o índice composto (mais eficiente)
    const applicationsThisMonth = await admin.firestore()
      .collection('applications')
      .where('candidateId', '==', candidateId)
      .where('createdAt', '>=', startOfMonthTimestamp)
      .get();
    
    count = applicationsThisMonth.size;
  } catch (error) {
    // Se o índice ainda estiver sendo construído ou não existir, usar fallback
    if (error.code === 9) {
      console.warn('⚠️ Índice ainda em construção, usando fallback...');
      
      // Fallback: buscar todas as candidaturas do candidato e filtrar no código
      const allApplications = await admin.firestore()
        .collection('applications')
        .where('candidateId', '==', candidateId)
        .get();
      
      // Filtrar no código as candidaturas do mês atual
      count = allApplications.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return false;
        
        const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        return createdAt >= startOfMonth;
      }).length;
    } else {
      // Se for outro erro, relançar
      throw error;
    }
  }
  const limit = features.maxApplicationsPerMonth;

  if (count >= limit) {
    return {
      allowed: false,
      reason: `Você atingiu o limite de ${limit} candidaturas gratuitas por mês.`,
      current: count,
      limit: limit,
      code: 'APPLICATION_LIMIT_REACHED',
      upgradeMessage: 'Faça upgrade para o plano Profissional ou Premium para candidaturas ilimitadas!',
      upgradeUrl: '/premium/candidatos'
    };
  }

  return {
    allowed: true,
    remaining: limit - count,
    limit: limit
  };
}

/**
 * Verifica se o candidato pode salvar mais vagas
 */
export async function canSaveJob(candidateId, planId, admin) {
  const features = getCandidatePlanFeatures(planId);
  
  if (!features.canSaveJobs) {
    return {
      allowed: false,
      reason: 'Salvar vagas favoritas é um recurso exclusivo dos planos Profissional e Premium.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para o plano Profissional ou Premium para salvar vagas favoritas!',
      upgradeUrl: '/premium/candidatos'
    };
  }

  // Plano premium tem vagas salvas ilimitadas
  if (features.maxSavedJobs === null) {
    return { allowed: true };
  }

  // Contar vagas salvas
  const savedJobsRef = admin.firestore()
    .collection('savedJobs')
    .where('candidateId', '==', candidateId);
  
  const savedJobs = await savedJobsRef.get();
  const count = savedJobs.size;
  const limit = features.maxSavedJobs;

  if (count >= limit) {
    return {
      allowed: false,
      reason: `Você atingiu o limite de ${limit} vagas salvas do plano ${features.name}.`,
      current: count,
      limit: limit,
      code: 'SAVED_JOBS_LIMIT_REACHED',
      upgradeMessage: 'Faça upgrade para o plano Premium para vagas salvas ilimitadas!',
      upgradeUrl: '/premium/candidatos'
    };
  }

  return {
    allowed: true,
    remaining: limit - count,
    limit: limit
  };
}

/**
 * Verifica se o candidato pode fazer upload de certificados
 */
export function canUploadCertificate(planId, currentCount = 0) {
  const features = getCandidatePlanFeatures(planId);
  
  if (!features.canUploadCertificates) {
    return {
      allowed: false,
      reason: 'Upload de certificados é um recurso exclusivo dos planos Profissional e Premium.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para o plano Profissional ou Premium para fazer upload de certificados!',
      upgradeUrl: '/premium/candidatos'
    };
  }

  if (features.maxCertificates === null) {
    return { allowed: true };
  }

  if (currentCount >= features.maxCertificates) {
    return {
      allowed: false,
      reason: `Você atingiu o limite de ${features.maxCertificates} certificados do plano ${features.name}.`,
      current: currentCount,
      limit: features.maxCertificates,
      code: 'CERTIFICATES_LIMIT_REACHED',
      upgradeMessage: 'Faça upgrade para o plano Premium para certificados ilimitados!',
      upgradeUrl: '/premium/candidatos'
    };
  }

  return {
    allowed: true,
    remaining: features.maxCertificates - currentCount,
    limit: features.maxCertificates
  };
}

/**
 * Verifica se o candidato pode se candidatar a uma vaga em destaque
 */
export function canApplyToFeaturedJob(planId) {
  const features = getCandidatePlanFeatures(planId);
  
  if (!features.canApplyToFeaturedJobs) {
    return {
      allowed: false,
      reason: 'Candidatar-se a vagas em destaque é um recurso exclusivo dos planos Profissional e Premium.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para o plano Profissional ou Premium para acessar vagas exclusivas!',
      upgradeUrl: '/premium/candidatos'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se o candidato pode verificar o perfil
 */
export function canVerifyProfile(planId) {
  const features = getCandidatePlanFeatures(planId);
  
  if (!features.canVerifyProfile) {
    return {
      allowed: false,
      reason: 'Verificação de perfil é um recurso exclusivo do plano Verificação.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Ative o plano Verificação para submeter o seu perfil para análise.',
      upgradeUrl: '/premium/candidatos'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se o candidato pode usar o gerador de CV avançado
 */
export function canUseCvGenerator(planId) {
  const features = getCandidatePlanFeatures(planId);

  if (!features.canUseCvGenerator) {
    return {
      allowed: false,
      reason: 'O gerador de CV em PDF é um recurso exclusivo dos planos Profissional e Premium.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage: 'Faça upgrade para o plano Profissional ou Premium para criar CVs completos em PDF.',
      upgradeUrl: '/premium/candidatos'
    };
  }

  return { allowed: true };
}

/**
 * Verifica se o plano está ativo (não expirado)
 * Se planEndDate for null, significa que o plano não expira (ilimitado)
 */
export function isPlanActive(planEndDate) {
  // Se não há data de término, o plano é ilimitado (sempre ativo)
  if (!planEndDate || planEndDate === null) {
    return true; // Plano ilimitado está sempre ativo
  }
  
  // Se há data de término, verificar se ainda não expirou
  try {
    const endDate = planEndDate.toDate ? planEndDate.toDate() : new Date(planEndDate);
    return endDate > new Date();
  } catch (error) {
    console.error('Erro ao verificar data de término do plano:', error);
    return false;
  }
}

/**
 * Obtém informações resumidas do plano do candidato
 * Se não houver plano ou se o plano expirou, retorna o plano básico (gratuito)
 */
export function getPlanSummary(userData) {
  // Se não tem plano definido, usar básico
  let planId = normalizeCandidatePlanId(
    userData.currentPlan || userData.planId || 'basic_candidato',
    userData.planName,
    userData
  );
  
  // Se tem planoEndDate, verificar se está ativo
  // Se expirou, voltar para o plano básico (gratuito não tem prazo)
  if (planId !== 'basic_candidato') {
    const isActive = isPlanActive(userData.planEndDate);
    if (!isActive && userData.planEndDate !== null) {
      // Plano expirado (mas não é ilimitado), voltar para básico
      planId = 'basic_candidato';
    }
  }
  
  const features = getCandidatePlanFeatures(planId, userData.planName, userData);
  const isActive = planId === 'basic_candidato' 
    ? true // Plano básico sempre está ativo
    : isPlanActive(userData.planEndDate); // Verificar se plano pago está ativo
  
  // Calcular dias restantes
  let daysRemaining = null;
  if (planId !== 'basic_candidato' && userData.planEndDate) {
    try {
      const endDate = userData.planEndDate.toDate ? userData.planEndDate.toDate() : new Date(userData.planEndDate);
      const diff = endDate.getTime() - new Date().getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error('Erro ao calcular dias restantes:', error);
      daysRemaining = null;
    }
  }
  
  return {
    planId,
    planName: userData.planName || features.name, // Usar planName do usuário se disponível
    price: features.price,
    isActive: isActive,
    features,
    daysRemaining: daysRemaining
  };
}
