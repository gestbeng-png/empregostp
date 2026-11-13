import { isUserAccountActive } from './userStatus';

/**
 * Sistema de Recursos e Limites por Plano - Candidatos
 *
 * Define os recursos disponíveis para cada plano de candidato
 * e funções para verificar limites e permissões
 */

// Configuração de recursos por plano.
//
// Regra (F2.1/G2.1/K1, decisão do utilizador 2026-10-10, ADR-016): candidatar-se,
// guardar vagas, alertas, recomendações, notificações de estado, carta manual,
// acesso a todas as vagas e o CV (upload + gerador de 1 modelo ATS) são
// gratuitos para todos. Nenhum plano dá prioridade, destaque ou melhor
// posição — nem nas candidaturas, nem nas pesquisas. Os planos pagos vendem
// serviços: verificação do perfil (Verificação), Career+ (Profissional:
// estatísticas, quem viu o perfil, assistente de carta, suporte prioritário)
// e Premium (Career+ com verificação incluída e suporte VIP).
const FREE_FOR_EVERYONE = Object.freeze({
  maxApplicationsPerMonth: null, // Só o limite anti-spam (D13), nunca comercial
  canSaveJobs: true,
  maxSavedJobs: null,
  curriculoDestacado: false, // Proibido: destaque pago do candidato
  priorityInSearch: false, // Proibido: ranking pago
  canReceiveNotifications: true, // Estados da candidatura são transacionais
  canReceivePersonalizedJobs: true,
  canReceiveRecommendations: true,
  canApplyToFeaturedJobs: true,
  canUploadCV: true,
  canUploadCertificates: true,
  maxCertificates: 5,
  canUseCvGenerator: true, // Um modelo ATS (F6.1)
  canAccessPremiumJobs: true,
  canAccessEarlyAccessJobs: true,
  canUseCoverLetter: true, // Carta manual
  applicationPriorityLevel: 0, // Proibido: candidatura prioritária
  canViewStats: false,
  canSeeWhoViewedProfile: false,
  canVerifyProfile: false,
  canUsePremiumApplicationTools: false,
  supportLevel: 'basic',
});

export const PLAN_FEATURES = {
  basic_candidato: {
    ...FREE_FOR_EVERYONE,
    name: 'Básico',
    price: 0,
  },
  verification_candidato: {
    ...FREE_FOR_EVERYONE,
    name: 'Verificação',
    price: 20,
    canVerifyProfile: true,
  },
  professional_candidato: {
    ...FREE_FOR_EVERYONE,
    name: 'Profissional',
    price: 50,
    canViewStats: true,
    canSeeWhoViewedProfile: true, // Nomes das empresas (a contagem é grátis)
    canUsePremiumApplicationTools: true, // Assistente de carta (Career+)
    supportLevel: 'priority',
  },
  unlimited_candidato: {
    ...FREE_FOR_EVERYONE,
    name: 'Premium',
    price: 200,
    canViewStats: true,
    canSeeWhoViewedProfile: true,
    canUsePremiumApplicationTools: true,
    canVerifyProfile: true,
    maxCertificates: null,
    supportLevel: 'vip',
  },
};

// Encontrar também Premium antigos que ainda não têm flags de verificação.
export const PREMIUM_CANDIDATE_QUERY_FILTERS = [
  ...['unlimited_candidato', 'premium', 'premium_candidato', 'unlimited'].map(
    (id) => ['currentPlan', id],
  ),
  ['planTierId', 'unlimited_candidato'],
  ['planId', 'unlimited_candidato'],
  ['planName', 'Premium'],
];

export function normalizeCandidatePlanId(planId, planName = '', metadata = {}) {
  const normalizedId = String(planId || '')
    .toLowerCase()
    .trim();
  if (PLAN_FEATURES[normalizedId]) {
    return normalizedId;
  }
  if (['premium', 'premium_candidato', 'unlimited'].includes(normalizedId)) {
    return 'unlimited_candidato';
  }

  const normalizedName = String(planName || '')
    .toLowerCase()
    .trim();
  if (normalizedName.includes('verifica')) return 'verification_candidato';
  if (
    normalizedName.includes('profissional') ||
    normalizedName.includes('professional') ||
    normalizedName === 'pro'
  ) {
    return 'professional_candidato';
  }
  if (
    normalizedName.includes('premium') ||
    normalizedName.includes('ilimit') ||
    normalizedName.includes('vip')
  ) {
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

  if (maxApplicationsPerMonth === null || canSeeWhoViewedProfile === true) {
    return 'unlimited_candidato';
  }
  if (
    (Number.isFinite(Number(maxApplicationsPerMonth)) &&
      Number(maxApplicationsPerMonth) > 3) ||
    canUseCvGenerator === true
  ) {
    return 'professional_candidato';
  }
  if (canVerifyProfile === true) return 'verification_candidato';

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
export async function canApplyToJob(_candidateId, _planId, _admin) {
  return { allowed: true };
}

/**
 * Verifica se o candidato pode salvar mais vagas
 */
export async function canSaveJob(_candidateId, _planId, _admin) {
  return { allowed: true };
}

/**
 * Verifica se o candidato pode fazer upload de certificados.
 * Nunca é exclusivo de plano — todos os planos permitem upload, só o limite
 * de quantidade varia (5 para Básico/Verificação/Profissional, ilimitado no Premium).
 */
export function canUploadCertificate(planId, currentCount = 0) {
  const features = getCandidatePlanFeatures(planId);

  if (features.maxCertificates === null) {
    return { allowed: true };
  }

  if (currentCount >= features.maxCertificates) {
    return {
      allowed: false,
      reason: `Atingiu o limite de ${features.maxCertificates} certificados do plano ${features.name}.`,
      current: currentCount,
      limit: features.maxCertificates,
      code: 'CERTIFICATES_LIMIT_REACHED',
      upgradeMessage:
        'Mude para o plano Premium para ter certificados ilimitados.',
      upgradeUrl: '/premium/candidatos',
    };
  }

  return {
    allowed: true,
    remaining: features.maxCertificates - currentCount,
    limit: features.maxCertificates,
  };
}

/**
 * Verifica se o candidato pode usar ferramentas premium de candidatura
 */
export function canUsePremiumApplicationTools(planId) {
  const features = getCandidatePlanFeatures(planId);

  if (!features.canUsePremiumApplicationTools) {
    return {
      allowed: false,
      reason:
        'O assistente de carta de apresentação está disponível nos planos Profissional e Premium. A carta escrita por si é gratuita.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage:
        'Faça upgrade para usar o assistente de carta. Nenhum plano dá prioridade nas candidaturas.',
      upgradeUrl: '/premium/candidatos',
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
      reason:
        'Verificação de perfil está disponível nos planos Verificação e Premium.',
      code: 'FEATURE_PRO_ONLY',
      upgradeMessage:
        'Ative o plano Verificação para análise documental ou o Premium com verificação automática incluída.',
      upgradeUrl: '/premium/candidatos',
    };
  }

  return { allowed: true };
}

/**
 * O gerador de CV ATS é gratuito para todos.
 */
export function canUseCvGenerator(_planId) {
  return { allowed: true };
}

/**
 * Verifica se o plano está ativo (não expirado)
 * Se planEndDate for null, significa que o plano não expira (ilimitado)
 */
function planDateMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  // Firestore Timestamp depois de passar por JSON (API/dashboard).
  const seconds = value?.seconds ?? value?._seconds;
  if (typeof seconds === 'number') return seconds * 1000;
  return new Date(value).getTime();
}

export function isPlanActive(planEndDate) {
  // Se não há data de término, o plano é ilimitado (sempre ativo)
  if (planEndDate === null || planEndDate === undefined) {
    return true; // Plano ilimitado está sempre ativo
  }

  // Se há data de término, verificar se ainda não expirou
  try {
    return planDateMillis(planEndDate) > Date.now();
  } catch (error) {
    console.error('Erro ao verificar data de término do plano:', error);
    return false;
  }
}

/**
 * Premium ativo inclui o selo pago automaticamente. Só o plano já ativado em
 * users conta: pedidos de pagamento, capacidades gratuitas e dados do perfil
 * não podem conceder este benefício. Não simula uma revisão de documentos.
 */
export function hasActivePremiumVerification(userData = {}) {
  if (userData.userType && userData.userType !== 'candidato') return false;
  if (
    !isUserAccountActive(userData) ||
    userData.verificationDisabled === true
  ) {
    return false;
  }
  const activatedPlan =
    userData.currentPlan || userData.planTierId || userData.planId;
  if (!activatedPlan) return false;
  // Sem a heurística de recursos: vários recursos antes pagos já são grátis.
  const tier = normalizeCandidatePlanId(activatedPlan, userData.planName);
  if (tier !== 'unlimited_candidato' || !isPlanActive(userData.planEndDate)) {
    return false;
  }
  if (userData.planStartDate != null) {
    try {
      if (!(planDateMillis(userData.planStartDate) <= Date.now())) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Obtém informações resumidas do plano do candidato
 * Se não houver plano ou se o plano expirou, retorna o plano básico (gratuito)
 */
export function getPlanSummary(userData) {
  // Se não tem plano definido, usar básico
  let planId = normalizeCandidatePlanId(
    userData.currentPlan ||
      userData.planTierId ||
      userData.planId ||
      'basic_candidato',
    userData.planName,
    userData,
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

  const features = getCandidatePlanFeatures(
    planId,
    userData.planName,
    userData,
  );
  const isActive =
    planId === 'basic_candidato'
      ? true // Plano básico sempre está ativo
      : isPlanActive(userData.planEndDate); // Verificar se plano pago está ativo

  // Calcular dias restantes
  let daysRemaining = null;
  if (planId !== 'basic_candidato' && userData.planEndDate) {
    try {
      const diff = planDateMillis(userData.planEndDate) - Date.now();
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
    daysRemaining: daysRemaining,
  };
}
