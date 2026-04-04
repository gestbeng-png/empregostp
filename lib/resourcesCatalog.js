export const RESOURCE_AUDIENCE = {
  all: 'all',
  candidato: 'candidato',
  empresa: 'empresa'
};

export const DEFAULT_TEMPLATES = [
  {
    id: 'cv-classico',
    category: 'CV',
    audience: RESOURCE_AUDIENCE.candidato,
    title: 'Curriculo Classico',
    description: 'Modelo objetivo para candidaturas formais e vagas administrativas.',
    format: 'TXT',
    downloads: 2453,
    color: '#6366f1'
  },
  {
    id: 'cv-moderno',
    category: 'CV',
    audience: RESOURCE_AUDIENCE.candidato,
    title: 'Curriculo Moderno',
    description: 'Layout enxuto para tecnologia, marketing e areas digitais.',
    format: 'TXT',
    downloads: 3124,
    color: '#6366f1'
  },
  {
    id: 'carta-motivacao',
    category: 'Carta',
    audience: RESOURCE_AUDIENCE.candidato,
    title: 'Carta de Motivacao',
    description: 'Estrutura pronta para personalizar candidatura por vaga.',
    format: 'TXT',
    downloads: 2918,
    color: '#10b981'
  },
  {
    id: 'job-description',
    category: 'Contrato',
    audience: RESOURCE_AUDIENCE.empresa,
    title: 'Modelo de Descricao de Vaga',
    description: 'Checklist para empresas publicarem vagas claras e atrativas.',
    format: 'TXT',
    downloads: 1650,
    color: '#f59e0b'
  },
  {
    id: 'proposta-salarial',
    category: 'Contrato',
    audience: RESOURCE_AUDIENCE.empresa,
    title: 'Modelo de Proposta Salarial',
    description: 'Estrutura de proposta para acelerar aprovacao interna e fechamento.',
    format: 'TXT',
    downloads: 982,
    color: '#f59e0b'
  },
  {
    id: 'contrato-freelancer',
    category: 'Freelancer',
    audience: RESOURCE_AUDIENCE.empresa,
    title: 'Contrato de Prestacao de Servicos',
    description: 'Modelo para projetos pontuais com clausulas essenciais.',
    format: 'TXT',
    downloads: 1432,
    color: '#ec4899'
  }
];

export const DEFAULT_GUIDES = [
  {
    id: 'guia-entrevista-candidato',
    title: 'Guia de Entrevista para Candidatos',
    description: 'Preparacao pratica para entrevistas presenciais e remotas.',
    readTime: '15 min',
    pages: 24,
    category: 'Carreira',
    audience: RESOURCE_AUDIENCE.candidato,
    color: '#6366f1',
    popular: true
  },
  {
    id: 'guia-negociacao-salarial',
    title: 'Guia de Negociacao Salarial',
    description: 'Como negociar remuneracao com argumentos objetivos.',
    readTime: '12 min',
    pages: 18,
    category: 'Carreira',
    audience: RESOURCE_AUDIENCE.candidato,
    color: '#10b981',
    popular: false
  },
  {
    id: 'guia-entrevista-empresa',
    title: 'Playbook de Entrevistas para Empresas',
    description: 'Roteiro para triagem, entrevista e avaliacao de candidatos.',
    readTime: '18 min',
    pages: 30,
    category: 'Recrutamento',
    audience: RESOURCE_AUDIENCE.empresa,
    color: '#f59e0b',
    popular: true
  },
  {
    id: 'guia-onboarding',
    title: 'Guia de Onboarding de Novos Colaboradores',
    description: 'Plano de 30 dias para integracao e produtividade inicial.',
    readTime: '14 min',
    pages: 20,
    category: 'Gestao',
    audience: RESOURCE_AUDIENCE.empresa,
    color: '#ec4899',
    popular: false
  }
];

export const DEFAULT_TOOLS = [
  {
    id: 'tool-cv-builder-europass',
    icon: 'document',
    title: 'Criador de CV (estilo Europass)',
    description: 'Crie um CV completo em 2 colunas e exporte um PDF A4 bem formatado.',
    color: '#0ea5e9',
    link: '/recursos/gerador-cv',
    audience: RESOURCE_AUDIENCE.candidato,
    requiresProfessional: true,
    pricing: 'Profissional ou Premium'
  },
  {
    id: 'tool-salary',
    icon: 'calculator',
    title: 'Calculadora Salarial',
    description: 'Estimativa de faixa salarial para candidatos e orcamento para empresas.',
    color: '#6366f1',
    link: '/recursos/calculadora-salarial',
    audience: RESOURCE_AUDIENCE.all,
    requiresProfessional: true,
    pricing: 'Exclusivo para plano Profissional'
  },
  {
    id: 'tool-tax',
    icon: 'scale',
    title: 'Calculadora de Impostos',
    description: 'Estimativa de descontos e salario liquido para diferentes perfis.',
    color: '#f59e0b',
    link: '/recursos/calculadora-impostos',
    audience: RESOURCE_AUDIENCE.all,
    requiresProfessional: true,
    pricing: 'Exclusivo para plano Profissional'
  }
];

export const DEFAULT_FAQS = [
  {
    id: 'faq1',
    question: 'Como me candidatar a uma vaga no EmpregoSTP?',
    answer: 'Crie uma conta gratuita, complete seu perfil e CV, navegue pelas vagas disponiveis e clique em "Candidatar-me" nas oportunidades que lhe interessam. O empregador recebera sua candidatura automaticamente.'
  },
  {
    id: 'faq2',
    question: 'Quanto custa usar a plataforma?',
    answer: 'Para candidatos, a plataforma e 100% gratuita. Voce pode criar perfil, candidatar-se a vagas e usar recursos basicos sem qualquer custo. Oferecemos planos premium com recursos adicionais para quem deseja mais visibilidade.'
  },
  {
    id: 'faq3',
    question: 'Como sei se minha candidatura foi vista?',
    answer: 'No seu dashboard, voce pode acompanhar o status de todas as suas candidaturas. Quando um empregador visualiza seu perfil ou altera o status, voce recebe uma notificacao automatica.'
  },
  {
    id: 'faq4',
    question: 'Posso editar minha candidatura depois de enviar?',
    answer: 'Voce pode atualizar seu CV e perfil a qualquer momento. As alteracoes ficam disponiveis para todos os empregadores. No entanto, mensagens enviadas junto com candidaturas nao podem ser editadas.'
  },
  {
    id: 'faq5',
    question: 'Como funciona a verificacao de perfil?',
    answer: 'A verificacao confirma sua identidade e aumenta sua credibilidade. Voce pode verificar seu email, telefone e documentos. Perfis verificados tem ate 3x mais visualizacoes de empregadores.'
  },
  {
    id: 'faq6',
    question: 'Quanto tempo as vagas ficam ativas?',
    answer: 'As vagas ficam ativas por 30 dias por padrao, mas os empregadores podem estender ou encerrar antes. Recomendamos candidatar-se o mais rapido possivel as oportunidades interessantes.'
  }
];

export const TEMPLATE_CONTENTS = {
  'cv-classico': `# Modelo de Curriculo Classico

Nome Completo:
Telefone:
Email:
Localizacao:

## Resumo Profissional
Escreva em 3-5 linhas sua experiencia principal e objetivo.

## Experiencia Profissional
- Empresa | Cargo | Periodo
  Principais resultados:
  - Resultado 1
  - Resultado 2

## Formacao Academica
- Curso | Instituicao | Ano

## Competencias
- Competencia 1
- Competencia 2

## Idiomas
- Idioma | Nivel
`,
  'cv-moderno': `# Curriculo Moderno

NOME COMPLETO
Cargo/Area:
Telefone | Email | LinkedIn

## Perfil
Resumo objetivo com foco em impacto e resultados.

## Projetos e Resultados
1. Projeto:
   - Contexto:
   - Acao:
   - Resultado:

## Experiencia
- Empresa | Cargo | Periodo | Principais entregas

## Formacao e Certificacoes
- Formacao:
- Certificacoes:

## Competencias Tecnicas
- Ferramenta/Skill 1
- Ferramenta/Skill 2
`,
  'carta-motivacao': `Assunto: Candidatura para [Nome da Vaga]

Prezada equipa de recrutamento,

Meu nome e [Nome] e manifesto interesse na vaga de [Cargo]. Tenho experiencia em [area], com foco em [competencias-chave].

Nos ultimos [X] anos, atuei em [contexto], entregando [resultado relevante]. Acredito que posso contribuir para [objetivo da empresa] atraves de [proposta de valor].

Fico disponivel para entrevista e agradeco pela consideracao.

Atenciosamente,
[Nome]
[Telefone]
[Email]
`,
  'job-description': `# Template de Descricao de Vaga (Empresa)

## 1. Dados da vaga
- Titulo da vaga:
- Area:
- Tipo de contrato:
- Regime (presencial/hibrido/remoto):
- Localizacao:

## 2. Responsabilidades
- Responsabilidade 1
- Responsabilidade 2

## 3. Requisitos obrigatorios
- Requisito 1
- Requisito 2

## 4. Diferenciais
- Diferencial 1
- Diferencial 2

## 5. Faixa salarial e beneficios
- Salario:
- Beneficios:

## 6. Etapas do processo seletivo
- Triagem curricular
- Entrevista tecnica
- Entrevista final
`,
  'proposta-salarial': `# Proposta Salarial

Empresa:
Candidato:
Cargo:
Data:

## Condicoes financeiras
- Salario base:
- Subsidios:
- Bonus:
- Beneficios:

## Condicoes contratuais
- Tipo de contrato:
- Periodo experimental:
- Data prevista de inicio:

## Observacoes
[Inserir detalhes adicionais]

Assinaturas:
Empresa:
Candidato:
`,
  'contrato-freelancer': `# Contrato de Prestacao de Servicos (Freelancer)

Partes:
- Contratante:
- Prestador:

Objeto do contrato:
[Descrever servico]

Prazo:
[Data inicio] ate [Data fim]

Valor e forma de pagamento:
- Valor total:
- Parcelas:
- Condicoes:

Entregaveis:
- Entregavel 1
- Entregavel 2

Clausulas gerais:
- Confidencialidade
- Propriedade intelectual
- Rescisao

Assinaturas:
Contratante:
Prestador:
`
};

export const GUIDE_CONTENTS = {
  'guia-entrevista-candidato': `# Guia de Entrevista para Candidatos

## Antes da entrevista
- Estude a empresa e a vaga.
- Prepare exemplos de resultados concretos.
- Treine respostas para perguntas frequentes.

## Durante
- Responda com clareza e objetividade.
- Use o formato Contexto -> Acao -> Resultado.
- Faça perguntas sobre objetivos da funcao.

## Depois
- Envie mensagem de agradecimento.
- Registre aprendizados para proximas entrevistas.
`,
  'guia-negociacao-salarial': `# Guia de Negociacao Salarial

## Passo 1: Defina sua faixa
- Minimo aceitavel
- Faixa alvo
- Faixa ideal

## Passo 2: Argumentos
- Resultados anteriores
- Competencias criticas para a vaga
- Dados de mercado

## Passo 3: Estrategia
- Escute a proposta completa.
- Negocie pacote total (salario + beneficios).
- Formalize acordos por escrito.
`,
  'guia-entrevista-empresa': `# Playbook de Entrevistas para Empresas

## Estrutura recomendada
1. Triagem inicial (15 min)
2. Entrevista tecnica (45 min)
3. Entrevista de alinhamento (30 min)

## Critérios de avaliacao
- Competencia tecnica
- Comunicacao
- Fit com cultura
- Potencial de crescimento

## Boas praticas
- Use roteiro padrao por vaga.
- Avalie por scorecard objetivo.
- Dê feedback rapido ao candidato.
`,
  'guia-onboarding': `# Guia de Onboarding (30 dias)

## Semana 1
- Acesso a ferramentas
- Alinhamento de metas
- Apresentacao da equipa

## Semana 2
- Primeiras entregas assistidas
- Checkpoint com gestor

## Semana 3
- Entregas autonomas
- Feedback tecnico

## Semana 4
- Revisao de performance inicial
- Plano de desenvolvimento de 90 dias
`
};

export function slugifyFilename(value) {
  return String(value || 'recurso')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const TEMPLATE_TITLE_TO_ID = {
  'curriculo classico': 'cv-classico',
  'curriculo moderno': 'cv-moderno',
  'carta de motivacao': 'carta-motivacao',
  'modelo de descricao de vaga': 'job-description',
  'modelo de proposta salarial': 'proposta-salarial',
  'contrato de prestacao de servicos': 'contrato-freelancer'
};

const GUIDE_TITLE_TO_ID = {
  'guia de entrevista para candidatos': 'guia-entrevista-candidato',
  'guia de negociacao salarial': 'guia-negociacao-salarial',
  'playbook de entrevistas para empresas': 'guia-entrevista-empresa',
  'guia de onboarding de novos colaboradores': 'guia-onboarding'
};

export function normalizeAudience(value, fallback = RESOURCE_AUDIENCE.all) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === RESOURCE_AUDIENCE.candidato) {
    return RESOURCE_AUDIENCE.candidato;
  }
  if (normalized === RESOURCE_AUDIENCE.empresa) {
    return RESOURCE_AUDIENCE.empresa;
  }
  if (normalized === RESOURCE_AUDIENCE.all || normalized === 'todos') {
    return RESOURCE_AUDIENCE.all;
  }
  return fallback;
}

export function resolveTemplateContentId(template) {
  const explicitId = String(template?.id || '').trim();
  if (explicitId && TEMPLATE_CONTENTS[explicitId]) {
    return explicitId;
  }

  const normalizedTitle = String(template?.title || '').trim().toLowerCase();
  if (normalizedTitle && TEMPLATE_TITLE_TO_ID[normalizedTitle]) {
    return TEMPLATE_TITLE_TO_ID[normalizedTitle];
  }

  return null;
}

export function resolveGuideContentId(guide) {
  const explicitId = String(guide?.id || '').trim();
  if (explicitId && GUIDE_CONTENTS[explicitId]) {
    return explicitId;
  }

  const normalizedTitle = String(guide?.title || '').trim().toLowerCase();
  if (normalizedTitle && GUIDE_TITLE_TO_ID[normalizedTitle]) {
    return GUIDE_TITLE_TO_ID[normalizedTitle];
  }

  return null;
}

export function resourceCanDownloadTemplate(template) {
  return Boolean(resolveTemplateContentId(template));
}

export function resourceCanDownloadGuide(guide) {
  return Boolean(resolveGuideContentId(guide));
}
