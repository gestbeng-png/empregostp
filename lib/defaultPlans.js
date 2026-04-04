// Single source of truth for "built-in" plans used across UI and API fallbacks.
// Keep these ids stable because they are referenced in business rules and user documents.

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

export const DEFAULT_CANDIDATO_PLANS = [
  {
    id: 'basic_candidato',
    name: 'Básico',
    type: 'candidato',
    price: 0,
    priceLabel: 'Gratuito',
    duration: 30,
    curriculoDestacado: false,
    features: [
      '3 candidaturas por mês',
      'Cadastro de currículo',
      'Candidatura a vagas básicas',
      'Suporte básico',
    ],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'professional_candidato',
    name: 'Profissional',
    type: 'candidato',
    price: 50,
    priceLabel: '50 Dobras',
    duration: 30,
    curriculoDestacado: true,
    features: [
      '20 candidaturas por mês',
      '50 vagas salvas',
      'Salvar vagas favoritas',
      'Currículo destacado',
      'Gerador de CV completo em PDF',
      'Candidatura a vagas em destaque',
      '5 certificados',
      'Prioridade nas buscas',
      'Notificações de vagas',
      'Suporte prioritário',
    ],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'unlimited_candidato',
    name: 'Premium',
    type: 'candidato',
    price: 200,
    priceLabel: '200 Dobras',
    duration: 30,
    curriculoDestacado: true,
    features: [
      'Candidaturas ilimitadas',
      'Vagas salvas ilimitadas',
      'Salvar vagas favoritas',
      'Certificados ilimitados',
      'Gerador de CV completo em PDF',
      'Currículo super destacado',
      'Primeira posição nas buscas',
      'Candidatura a vagas em destaque',
      'Notificações em tempo real',
      'Estatísticas de visualização',
      'Suporte VIP',
    ],
    isDefault: true,
    isActive: true,
  },
];

export function normalizeUserType(userType) {
  const t = String(userType || '').toLowerCase().trim();
  if (t === 'empresa' || t === 'empresas' || t === 'company' || t === 'companies') return 'empresa';
  if (t === 'candidato' || t === 'candidatos' || t === 'candidate' || t === 'candidates') return 'candidato';
  return '';
}
