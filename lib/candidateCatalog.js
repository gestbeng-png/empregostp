

// Regra F2.1/G2.1 (ADR-016): candidatar-se é sempre gratuito e ilimitado
// (só há limite anti-spam); nenhum plano dá prioridade, destaque ou acesso
// exclusivo a vagas. Os planos pagos vendem serviços ao candidato. Preços
// inalterados (decisão humana, A4).
export const CANDIDATE_PLAN_CATALOG = [
  {
    id: 'basic_candidato',
    name: 'Básico',
    type: 'candidato',
    price: 0,
    priceLabel: 'Gratuito',
    duration: 30,
    curriculoDestacado: false,
    popular: false,
    isDefault: true,
    isActive: true,
    summary: 'Tudo o que precisa para encontrar trabalho e candidatar-se, sem pagar nada.',
    features: [
      'Candidaturas gratuitas e sem limite mensal',
      'Perfil profissional e upload de CV',
      'Gerador de CV (modelo ATS)',
      'Guardar vagas e alertas de vagas',
      'Acompanhamento de cada candidatura',
      'Carta de apresentação escrita por si',
    ],
    upgradeHighlights: [
      'Candidaturas sem limite',
      'Guardar vagas e alertas',
      'Gerador de CV',
      'Acompanhamento das candidaturas',
    ],
  },
  {
    id: 'verification_candidato',
    name: 'Verificação',
    type: 'candidato',
    price: 20,
    priceLabel: '20 Dobras',
    duration: 30,
    curriculoDestacado: false,
    popular: false,
    isDefault: true,
    isActive: true,
    summary: 'A equipa EmpregoSTP verifica o seu perfil e atribui o selo de candidato verificado.',
    features: [
      'Tudo o que o plano Básico inclui',
      'Pedido de verificação do perfil',
      'Selo de candidato verificado',
      'Mais confiança junto das empresas',
    ],
    upgradeHighlights: [
      'Verificação do perfil',
      'Selo de confiança',
      'Tudo o que o Básico inclui',
    ],
  },
  {
    id: 'professional_candidato',
    name: 'Profissional',
    type: 'candidato',
    price: 50,
    priceLabel: '50 Dobras',
    duration: 30,
    curriculoDestacado: false,
    popular: true,
    isDefault: true,
    isActive: true,
    summary: 'Ferramentas para preparar melhor as suas candidaturas. Não dá prioridade junto das empresas.',
    features: [
      'Tudo o que o plano Básico inclui',
      'Assistente de carta de apresentação',
      'Estatísticas do seu perfil',
      'Nomes das empresas que viram o seu perfil',
      'Suporte prioritário',
    ],
    upgradeHighlights: [
      'Assistente de carta',
      'Estatísticas do perfil',
      'Quem viu o seu perfil',
      'Suporte prioritário',
    ],
  },
  {
    id: 'unlimited_candidato',
    name: 'Premium',
    type: 'candidato',
    price: 200,
    priceLabel: '200 Dobras',
    duration: 30,
    curriculoDestacado: false,
    popular: false,
    isDefault: true,
    isActive: true,
    summary: 'As ferramentas do Profissional com verificação incluída. Não dá prioridade junto das empresas.',
    features: [
      'Tudo o que o plano Profissional inclui',
      'Verificação do perfil incluída',
      'Certificados ilimitados',
      'Suporte VIP',
    ],
    upgradeHighlights: [
      'Verificação incluída',
      'Assistente de carta',
      'Quem viu o seu perfil',
      'Suporte VIP',
    ],
  },
];

function clonePlan(plan) {
  return {
    ...plan,
    features: [...(plan.features || [])],
    upgradeHighlights: [...(plan.upgradeHighlights || [])],
  };
}

export function getCandidateMarketingPlans({ includeBasic = true, includeVerification = true } = {}) {
  return CANDIDATE_PLAN_CATALOG
    .filter((plan) => (includeBasic ? true : plan.id !== 'basic_candidato'))
    .filter((plan) => (includeVerification ? true : plan.id !== 'verification_candidato'))
    .map(clonePlan);
}

export function getCandidatePlanById(planId) {
  const normalized = String(planId || '').trim();
  const plan = CANDIDATE_PLAN_CATALOG.find((entry) => entry.id === normalized);
  return plan ? clonePlan(plan) : null;
}

export function getCandidateUpgradePlans() {
  return getCandidateMarketingPlans({ includeBasic: false }).map((plan) => ({
    name: plan.name,
    price: plan.priceLabel,
    highlight: [...(plan.upgradeHighlights || plan.features || [])].slice(0, 4),
    popular: Boolean(plan.popular),
  }));
}

