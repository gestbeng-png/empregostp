// Single source of truth for "built-in" plans used across UI and API fallbacks.
// Keep these ids stable because they are referenced in business rules and user documents.

import { getCandidateMarketingPlans, getCandidatePlanById } from './candidateCatalog';

// Escalões da proposta comercial de 2026-10 (preços em STD por mês). As
// listas só prometem o que o sistema aplica (lib/empresaPlanFeatures.js) ou o
// que a equipa presta a pedido. O plano Empresarial é negociado à parte.
export const DEFAULT_EMPRESA_PLANS = [
  {
    id: 'basic_empresa',
    name: 'Gratuito',
    type: 'empresa',
    vagasLimit: 1,
    destaque: false,
    price: 0,
    priceLabel: '0 STD',
    duration: 30,
    features: [
      'Perfil da empresa com logótipo e descrição',
      '1 vaga ativa de cada vez',
      'Receção e gestão básica de candidaturas',
      'Consulta dos perfis dos candidatos',
      'Registo de entrevistas',
      'Notificações da plataforma',
      'Suporte normal',
    ],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'essential_empresa',
    name: 'Essencial',
    type: 'empresa',
    vagasLimit: 3,
    destaque: true,
    price: 250,
    priceLabel: '250 STD',
    duration: 30,
    features: [
      'Até 3 vagas ativas',
      'Gestão completa de candidaturas',
      'Contactos dos candidatos',
      'Organização de entrevistas',
      '1 vaga em destaque de cada vez',
      'Analytics das vagas',
      'Perfil de empresa melhorado',
      'Suporte por email',
    ],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'professional_empresa',
    name: 'Profissional',
    type: 'empresa',
    vagasLimit: 10,
    destaque: true,
    price: 750,
    priceLabel: '750 STD',
    duration: 30,
    features: [
      'Até 10 vagas ativas',
      '2 vagas em destaque de cada vez',
      'Prioridade nas pesquisas',
      'Pesquisa por nome, competência e área',
      'Mensagens diretas com candidatos',
      'Analytics e exportação de dados',
      'Acompanhamento de entrevistas',
      'Suporte prioritário',
    ],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'unlimited_empresa',
    name: 'Ouro',
    type: 'empresa',
    vagasLimit: null,
    destaque: true,
    price: 2000,
    priceLabel: '2.000 STD',
    duration: 30,
    features: [
      'Vagas ilimitadas',
      'Todas as vagas em destaque',
      'Prioridade máxima nas pesquisas',
      'Banco de Talentos completo',
      'Mensagens diretas sem limite',
      'Analytics completos e relatórios',
      'Consultoria inicial e serviço RH prioritário',
      'Atendimento prioritário',
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
