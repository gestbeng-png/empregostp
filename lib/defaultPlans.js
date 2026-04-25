// Single source of truth for "built-in" plans used across UI and API fallbacks.
// Keep these ids stable because they are referenced in business rules and user documents.

import { getCandidateMarketingPlans, getCandidatePlanById } from './candidateCatalog';

export const DEFAULT_EMPRESA_PLANS = [
  {
    id: 'basic_empresa',
    name: 'Básico',
    type: 'empresa',
    vagasLimit: 1,
    destaque: false,
    price: 0,
    priceLabel: 'Grátis',
    duration: 30,
    features: [
      '1 vaga por mês',
      'Visualização de candidatos',
      'Suporte básico',
    ],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'professional_empresa',
    name: 'Profissional',
    type: 'empresa',
    vagasLimit: 5,
    destaque: true,
    price: 100,
    priceLabel: '100 Dobras',
    duration: 30,
    features: [
      '5 vagas por mês',
      'Vagas em destaque',
      'Prioridade nas buscas',
      'Suporte prioritário',
    ],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'unlimited_empresa',
    name: 'PRO',
    type: 'empresa',
    vagasLimit: null,
    destaque: true,
    price: 2000,
    priceLabel: '2000 Dobras',
    duration: 30,
    features: [
      'Vagas ilimitadas',
      'Mensagens diretas com candidatos',
      'Analytics completos',
      'Banco de talentos completo',
      'Serviços avançados e suporte prioritário',
      'Todas as vagas em destaque',
    ],
    isDefault: true,
    isActive: true,
  },
];

export const DEFAULT_CANDIDATO_PLANS = getCandidateMarketingPlans({
  includeBasic: true,
  includeVerification: true,
});

function cloneDefaultPlan(plan) {
  if (!plan) return null;

  return {
    ...plan,
    features: [...(plan.features || [])],
    upgradeHighlights: [...(plan.upgradeHighlights || [])],
  };
}

export function getDefaultEmpresaPlanById(planId = 'basic_empresa') {
  const normalized = String(planId || 'basic_empresa').trim();
  const plan = DEFAULT_EMPRESA_PLANS.find((entry) => entry.id === normalized);
  return cloneDefaultPlan(plan);
}

export function getDefaultCandidatoPlanById(planId = 'basic_candidato') {
  return cloneDefaultPlan(getCandidatePlanById(planId));
}

export function getDefaultBasicPlanForUserType(userType) {
  const normalizedUserType = normalizeUserType(userType);
  if (normalizedUserType === 'empresa') {
    return getDefaultEmpresaPlanById('basic_empresa');
  }
  if (normalizedUserType === 'candidato') {
    return getDefaultCandidatoPlanById('basic_candidato');
  }
  return null;
}

export function normalizeUserType(userType) {
  const t = String(userType || '').toLowerCase().trim();
  if (t === 'empresa' || t === 'empresas' || t === 'company' || t === 'companies') return 'empresa';
  if (t === 'candidato' || t === 'candidatos' || t === 'candidate' || t === 'candidates') return 'candidato';
  return '';
}
