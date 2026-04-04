import nookies from 'nookies';
import { admin } from './firebaseAdmin';
import { getPlanSummary } from './candidatePlanFeatures';
import { getEmpresaPlanSummary } from './empresaPlanFeatures';

const PROFESSIONAL_CANDIDATE_PLANS = new Set(['professional_candidato', 'unlimited_candidato']);
const PROFESSIONAL_EMPRESA_PLANS = new Set(['professional_empresa', 'unlimited_empresa']);

const DEFAULT_ACCESS = {
  isAuthenticated: false,
  allowed: false,
  userType: 'guest',
  userId: '',
  planId: '',
  planName: '',
  reason: 'Este recurso e exclusivo para perfis pagos (Profissional).',
  upgradeUrl: '/premium/candidatos',
  ctaUrl: '/login'
};

export function getProfessionalResourceAccessFromUser(userData = {}, userId = '') {
  const userType = userData.userType || 'guest';

  if (userType === 'admin') {
    return {
      isAuthenticated: true,
      allowed: true,
      userType,
      userId,
      planId: 'admin',
      planName: 'Admin',
      reason: '',
      upgradeUrl: '',
      ctaUrl: ''
    };
  }

  if (userType === 'candidato') {
    const planSummary = getPlanSummary(userData);
    const planId = planSummary.planId || 'basic_candidato';
    const allowed = PROFESSIONAL_CANDIDATE_PLANS.has(planId) && planSummary.isActive;
    return {
      isAuthenticated: true,
      allowed,
      userType,
      userId,
      planId,
      planName: planSummary.planName || '',
      reason: allowed ? '' : DEFAULT_ACCESS.reason,
      upgradeUrl: '/premium/candidatos',
      ctaUrl: allowed ? '' : '/premium/candidatos'
    };
  }

  if (userType === 'empresa') {
    const planSummary = getEmpresaPlanSummary(userData);
    const planId = planSummary.planId || 'basic_empresa';
    const allowed = PROFESSIONAL_EMPRESA_PLANS.has(planId) && planSummary.isActive;
    return {
      isAuthenticated: true,
      allowed,
      userType,
      userId,
      planId,
      planName: planSummary.planName || '',
      reason: allowed ? '' : DEFAULT_ACCESS.reason,
      upgradeUrl: '/premium/empresa',
      ctaUrl: allowed ? '' : '/premium/empresa'
    };
  }

  return {
    ...DEFAULT_ACCESS,
    isAuthenticated: true,
    userType,
    userId
  };
}

export async function resolveProfessionalResourceAccess(context) {
  try {
    const cookies = nookies.get(context);
    if (!cookies?.token) {
      return DEFAULT_ACCESS;
    }

    const decodedToken = await admin.auth().verifyIdToken(cookies.token);
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return DEFAULT_ACCESS;
    }

    const userData = userDoc.data() || {};
    const access = getProfessionalResourceAccessFromUser(userData, decodedToken.uid);
    if (!access.isAuthenticated) {
      return DEFAULT_ACCESS;
    }
    return access;
  } catch (error) {
    console.error('Falha ao validar acesso premium de recursos:', error);
    return DEFAULT_ACCESS;
  }
}
