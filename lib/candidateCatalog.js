const PLAN_LABELS = {
  basic_candidato: 'Básico',
  verification_candidato: 'Verificação',
  professional_candidato: 'Profissional',
  unlimited_candidato: 'Premium',
};

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
    summary: 'Entrada para criar perfil, candidatar-se a vagas e começar a usar a plataforma.',
    features: [
      '3 candidaturas por mês',
      'Criar perfil profissional',
      'Upload de CV',
      'Pesquisa e filtro de vagas',
      'Histórico de candidaturas',
    ],
    upgradeHighlights: [
      '3 candidaturas/mês',
      'Criar perfil profissional',
      'Upload de CV',
      'Histórico de candidaturas',
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
    summary: 'Plano focado em desbloquear a verificação do perfil e o selo de confiança.',
    features: [
      '3 candidaturas por mês',
      'Pedido de verificação do perfil',
      'Selo de candidato verificado',
      'Mais credibilidade junto às empresas',
    ],
    upgradeHighlights: [
      'Verificação de perfil',
      'Selo de confiança',
      '3 candidaturas/mês',
      'Mais credibilidade',
    ],
  },
  {
    id: 'professional_candidato',
    name: 'Profissional',
    type: 'candidato',
    price: 50,
    priceLabel: '50 Dobras',
    duration: 30,
    curriculoDestacado: true,
    popular: true,
    isDefault: true,
    isActive: true,
    summary: 'Mais visibilidade, mais candidaturas e recursos premium para subir o nível do perfil.',
    features: [
      '20 candidaturas por mês',
      '50 vagas salvas',
      'Currículo em destaque',
      'Gerador de CV completo em PDF',
      'Recomendações personalizadas',
      'Upload de até 5 certificados',
      'Candidatura a vagas em destaque',
      'Acesso antecipado a vagas premium',
      'Carta de apresentação personalizada',
      'Suporte prioritário',
    ],
    upgradeHighlights: [
      '20 candidaturas/mês',
      'Salvar vagas',
      'Gerador de CV em PDF',
      'Recomendações personalizadas',
    ],
  },
  {
    id: 'unlimited_candidato',
    name: 'Premium',
    type: 'candidato',
    price: 200,
    priceLabel: '200 Dobras',
    duration: 30,
    curriculoDestacado: true,
    popular: false,
    isDefault: true,
    isActive: true,
    summary: 'Pacote completo com candidaturas ilimitadas, inteligência avançada e máxima exposição.',
    features: [
      'Candidaturas ilimitadas',
      'Vagas salvas ilimitadas',
      'Quem viu o seu perfil',
      'Estatísticas de visualização',
      'Verificação incluída',
      'Certificados ilimitados',
      'Gerador de CV completo em PDF',
      'Prioridade máxima nas candidaturas',
      'Acesso antecipado a vagas premium',
      'Carta de apresentação personalizada',
      'Suporte VIP',
    ],
    upgradeHighlights: [
      'Candidaturas ilimitadas',
      'Quem viu o perfil',
      'Gerador de CV em PDF',
      'Suporte VIP',
    ],
  },
];

export const CANDIDATE_SERVICE_STATUS_META = {
  implemented: {
    label: 'Disponível',
    tone: 'implemented',
  },
  partial: {
    label: 'Parcial',
    tone: 'partial',
  },
  planned: {
    label: 'Planeado',
    tone: 'planned',
  },
};

const CATEGORY_PRESETS = {
  base: {
    label: 'Base',
    href: '/register?type=candidate',
    cta: 'Criar perfil',
    planIds: ['basic_candidato', 'professional_candidato', 'unlimited_candidato'],
    highlights: ['Ativação rápida', 'Fluxo simples', 'Uso essencial'],
    status: 'implemented',
  },
  visibility: {
    label: 'Visibilidade',
    href: '/premium/candidatos',
    cta: 'Ver destaque',
    planIds: ['professional_candidato', 'unlimited_candidato'],
    highlights: ['Mais exposição', 'Mais prioridade', 'Mais alcance'],
    featured: true,
    status: 'planned',
  },
  trust: {
    label: 'Credibilidade',
    href: '/dashboard/candidato?tab=verification',
    cta: 'Ver verificação',
    planIds: ['verification_candidato', 'unlimited_candidato'],
    highlights: ['Mais confiança', 'Mais autenticidade', 'Mais credibilidade'],
    verifiedRelated: true,
    status: 'partial',
  },
  premium: {
    label: 'Candidatura Premium',
    href: '/premium/candidatos',
    cta: 'Desbloquear',
    planIds: ['professional_candidato', 'unlimited_candidato'],
    highlights: ['Mais candidaturas', 'Mais prioridade', 'Mais acesso'],
    featured: true,
    status: 'planned',
  },
  optimization: {
    label: 'Otimização',
    href: '/recursos/gerador-cv',
    cta: 'Melhorar perfil',
    planIds: ['professional_candidato', 'unlimited_candidato'],
    highlights: ['Mais clareza', 'Mais compatibilidade', 'Melhor apresentação'],
    status: 'planned',
  },
  career: {
    label: 'Carreira',
    href: '/recursos',
    cta: 'Explorar recursos',
    planIds: ['professional_candidato', 'unlimited_candidato'],
    highlights: ['Desenvolvimento', 'Aprendizagem', 'Evolução profissional'],
    status: 'partial',
  },
  intelligence: {
    label: 'Inteligência',
    href: '/dashboard/candidato',
    cta: 'Ver insights',
    planIds: ['professional_candidato', 'unlimited_candidato'],
    highlights: ['Mais informação', 'Melhores decisões', 'Mais retenção'],
    featured: true,
    status: 'partial',
  },
  convenience: {
    label: 'Conveniência',
    href: '/dashboard/candidato',
    cta: 'Usar recursos',
    planIds: ['basic_candidato', 'professional_candidato', 'unlimited_candidato'],
    highlights: ['Menos fricção', 'Mais rapidez', 'Mais organização'],
    status: 'partial',
  },
  revenue: {
    label: 'Premium',
    href: '/premium/candidatos',
    cta: 'Ver premium',
    planIds: ['unlimited_candidato'],
    highlights: ['Maior valor', 'Maior receita', 'Maior retenção'],
    featured: true,
    status: 'planned',
  },
};

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createCandidateService(title, categoryKey, overrides = {}) {
  const preset = CATEGORY_PRESETS[categoryKey];
  const planIds = overrides.planIds || preset.planIds;

  return {
    id: overrides.id || slugify(title),
    category: overrides.category || preset.label,
    title,
    description:
      overrides.description ||
      'Este serviço ajuda o candidato a melhorar posicionamento, aumentar oportunidades e ter uma experiência mais forte dentro da plataforma.',
    highlights: overrides.highlights || preset.highlights,
    planIds,
    href: overrides.href || preset.href,
    cta: overrides.cta || preset.cta,
    featured: Boolean(overrides.featured ?? preset.featured),
    verifiedRelated: Boolean(
      overrides.verifiedRelated ??
        preset.verifiedRelated ??
        /verific|identidade|certificado|acad[êe]mica|experi[êe]ncia|compet[êe]ncia/i.test(title)
    ),
    status: overrides.status || preset.status || 'planned',
    gating: overrides.gating || { type: 'plan', planIds },
    dependencies: overrides.dependencies || [],
    source: overrides.source || [],
  };
}

const RAW_CANDIDATE_SERVICE_GROUPS = [
  {
    id: 'base',
    eyebrow: 'Essencial',
    title: 'Serviços base para candidatos',
    lead: 'O mínimo que a plataforma precisa oferecer para criar presença profissional, pesquisar vagas e gerir candidaturas.',
    services: [
      createCandidateService('Criar perfil profissional', 'base', {
        description: 'Monte a sua presença profissional na plataforma com dados pessoais, experiência e objetivo.',
        featured: true,
        dependencies: ['users', 'profiles'],
        source: ['pages/dashboard/candidato/index.js', 'pages/api/profile/update.js'],
      }),
      createCandidateService('Upload de CV', 'base', {
        description: 'Carregue o currículo para usar nas candidaturas e acelerar o processo com menos fricção.',
        dependencies: ['users.cvUrl', 'profiles.cvUrl'],
        source: ['pages/api/profile/upload-cv.js'],
      }),
      createCandidateService('Candidatura a vagas', 'base', {
        dependencies: ['applications', 'jobs'],
        source: ['pages/api/applications/index.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Pesquisa e filtro de vagas', 'base', {
        dependencies: ['jobs'],
        source: ['pages/vagas/index.js'],
      }),
      createCandidateService('Guardar vagas favoritas', 'convenience', {
        status: 'implemented',
        planIds: ['professional_candidato', 'unlimited_candidato'],
        cta: 'Usar recursos',
        dependencies: ['savedJobs'],
        source: ['pages/api/saved-jobs.js', 'pages/vagas/index.js'],
      }),
      createCandidateService('Alertas de novas vagas', 'intelligence', {
        status: 'partial',
        planIds: ['unlimited_candidato'],
        cta: 'Ver insights',
        dependencies: ['notifications', 'notify-candidates'],
        source: ['pages/api/notify-candidates.js', 'pages/api/notifications.js'],
      }),
      createCandidateService('Histórico de candidaturas', 'base', {
        dependencies: ['applications'],
        source: ['pages/dashboard/candidato/candidaturas.js', 'pages/api/profile.js'],
      }),
      createCandidateService('Página pessoal com competências, formação e experiência', 'base', {
        dependencies: ['profiles'],
        source: ['pages/dashboard/candidato/index.js', 'pages/api/profile/update.js'],
      }),
      createCandidateService('Candidatura rápida com 1 clique', 'base', {
        featured: true,
        status: 'planned',
        source: ['pages/vaga/[id].js'],
      }),
      createCandidateService('Gestão de documentos', 'base', {
        status: 'partial',
        dependencies: ['cv', 'certificateFiles'],
        source: ['pages/api/profile/upload-cv.js', 'pages/api/profile/update.js'],
      }),
    ],
  },
  {
    id: 'visibility',
    eyebrow: 'Exposição',
    title: 'Serviços de visibilidade do perfil',
    lead: 'Recursos que ajudam o candidato a aparecer mais, subir nas buscas e ganhar melhor posicionamento perante empresas.',
    services: [
      createCandidateService('Perfil em destaque nas pesquisas das empresas', 'visibility', {
        status: 'partial',
        dependencies: ['curriculoDestacado', 'candidate search ranking'],
        source: ['lib/candidatePlanFeatures.js', 'lib/publicCandidates.js'],
      }),
      createCandidateService('CV em destaque', 'visibility', {
        status: 'partial',
        dependencies: ['curriculoDestacado'],
        source: ['lib/candidatePlanFeatures.js'],
      }),
      createCandidateService('Selo “perfil completo”', 'visibility', {
        status: 'implemented',
        source: ['pages/dashboard/candidato/index.js', 'lib/candidateProfileInsights.js'],
      }),
      createCandidateService('Selo “candidato verificado”', 'trust', {
        featured: true,
        status: 'implemented',
        source: ['pages/api/verifications.js', 'lib/publicCandidates.js'],
      }),
      createCandidateService('Maior prioridade em recomendações', 'visibility', {
        status: 'partial',
        dependencies: ['recommendations ranking'],
        source: ['pages/api/recommendations.js'],
      }),
      createCandidateService('Boost temporário do perfil', 'visibility', {
        status: 'planned',
      }),
      createCandidateService('Maior exposição no banco de talentos', 'visibility', {
        status: 'partial',
        dependencies: ['candidate visibility', 'verified candidates'],
        source: ['lib/publicCandidates.js', 'pages/candidatos/[id].js'],
      }),
    ],
  },
  {
    id: 'trust',
    eyebrow: 'Confiança',
    title: 'Serviços de credibilidade e confiança',
    lead: 'Muito importantes para reforçar autenticidade, qualidade do perfil e confiança das empresas no candidato.',
    services: [
      createCandidateService('Verificação de identidade', 'trust', {
        featured: true,
        dependencies: ['verifications', 'documents'],
        source: ['pages/api/verifications.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Verificação de certificados', 'trust', {
        status: 'implemented',
        source: ['pages/api/verifications.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Verificação académica', 'trust', {
        status: 'implemented',
        source: ['pages/api/verifications.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Verificação de experiência profissional', 'trust', {
        status: 'implemented',
        source: ['pages/api/verifications.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Selo de candidato verificado', 'trust', {
        featured: true,
        status: 'implemented',
        source: ['pages/api/verifications.js', 'lib/publicCandidates.js'],
      }),
      createCandidateService('Perfil com percentagem de completude', 'trust', {
        status: 'implemented',
        source: ['lib/candidateProfileInsights.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Validação de competências', 'trust', {
        status: 'implemented',
        source: ['pages/api/verifications.js', 'pages/dashboard/candidato/index.js'],
      }),
    ],
  },
  {
    id: 'premium',
    eyebrow: 'Candidatura',
    title: 'Serviços de candidatura premium',
    lead: 'Recursos premium que aumentam valor percebido e melhoram a eficácia de cada candidatura.',
    services: [
      createCandidateService('Mais candidaturas por mês', 'premium', {
        status: 'implemented',
        source: ['lib/candidatePlanFeatures.js', 'pages/api/applications/index.js'],
      }),
      createCandidateService('Candidaturas prioritárias', 'premium', {
        status: 'implemented',
        source: ['pages/api/applications/index.js', 'pages/dashboard/empresa/index.js'],
      }),
      createCandidateService('Acesso antecipado a vagas', 'premium', {
        status: 'implemented',
        source: ['pages/api/jobs/index.js', 'pages/api/applications/index.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Candidatura destacada', 'premium', {
        status: 'implemented',
        source: ['pages/api/applications/index.js', 'pages/dashboard/empresa/index.js'],
      }),
      createCandidateService('Desbloqueio de vagas premium', 'premium', {
        status: 'implemented',
        dependencies: ['jobs.destaque', 'premium jobs'],
        source: ['pages/api/jobs/index.js', 'pages/api/applications/index.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Carta de apresentação personalizada', 'premium', {
        status: 'implemented',
        source: ['pages/vaga/[id].js', 'pages/api/applications/index.js'],
      }),
      createCandidateService('Sugestão automática de respostas', 'premium', {
        status: 'implemented',
        source: ['lib/candidateApplicationPremium.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Acompanhamento do estado da candidatura', 'premium', {
        status: 'implemented',
        planIds: ['basic_candidato', 'professional_candidato', 'unlimited_candidato'],
        dependencies: ['applications.timeline', 'notifications'],
        source: ['pages/dashboard/candidato/candidaturas.js', 'pages/api/applications/[id]/status.js'],
      }),
    ],
  },
  {
    id: 'optimization',
    eyebrow: 'Posicionamento',
    title: 'Serviços de otimização de perfil',
    lead: 'Perfeitos para transformar o perfil e o CV em ativos mais fortes para recrutamento e matching.',
    services: [
      createCandidateService('Criador de CV em PDF', 'optimization', {
        description: 'Recurso premium para montar um CV completo, estruturado e pronto para exportação em PDF.',
        href: '/recursos/gerador-cv',
        cta: 'Abrir criador',
        status: 'implemented',
        featured: true,
        highlights: ['Editor completo', 'Exportação em PDF', 'Pré-preenchimento do perfil'],
        dependencies: ['candidate plans', 'cv generator'],
        source: ['pages/recursos/gerador-cv.js', 'lib/candidatePlanFeatures.js'],
      }),
      createCandidateService('Análise de CV', 'optimization', {
        featured: true,
        planIds: ['unlimited_candidato'],
        status: 'implemented',
        dependencies: ['candidate optimization insights'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Sugestões de melhoria do perfil', 'optimization', {
        status: 'implemented',
        dependencies: ['candidate optimization insights'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Score de empregabilidade', 'optimization', {
        planIds: ['unlimited_candidato'],
        status: 'implemented',
        dependencies: ['candidate optimization insights'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/api/candidate/plan-status.js'],
      }),
      createCandidateService('Recomendação de competências em falta', 'optimization', {
        status: 'implemented',
        dependencies: ['candidate optimization insights', 'market skill gaps'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Otimização automática do CV para a vaga', 'optimization', {
        featured: true,
        planIds: ['unlimited_candidato'],
        status: 'implemented',
        dependencies: ['job fit analysis'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Geração de resumo profissional', 'optimization', {
        status: 'implemented',
        dependencies: ['candidate optimization insights'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Sugestão de palavras-chave para aparecer nas buscas', 'optimization', {
        status: 'implemented',
        dependencies: ['candidate optimization insights'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/dashboard/candidato/index.js'],
      }),
    ],
  },
  {
    id: 'career',
    eyebrow: 'Desenvolvimento',
    title: 'Serviços de carreira e desenvolvimento',
    lead: 'Recursos que diferenciam a plataforma de um simples job board e criam valor contínuo para o candidato.',
    services: [
      createCandidateService('Testes de competências', 'career', {
        status: 'partial',
        dependencies: ['skillsAssessment'],
        source: ['lib/skillsAssessment.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Certificados de conclusão', 'career', {
        status: 'planned',
      }),
      createCandidateService('Mini-cursos', 'career', {
        status: 'planned',
      }),
      createCandidateService('Conteúdo sobre entrevistas', 'career', {
        status: 'implemented',
        dependencies: ['resources catalog'],
        source: ['lib/resourcesCatalog.js', 'pages/recursos.js'],
      }),
      createCandidateService('Simulação de entrevista', 'career', {
        featured: true,
        status: 'planned',
      }),
      createCandidateService('Preparação para CV e carta', 'career', {
        status: 'partial',
        dependencies: ['resources'],
        source: ['lib/resourcesCatalog.js', 'pages/recursos.js'],
      }),
      createCandidateService('Mentoria profissional', 'career', {
        featured: true,
        planIds: ['unlimited_candidato'],
        status: 'planned',
      }),
      createCandidateService('Orientação de carreira', 'career', {
        status: 'partial',
        dependencies: ['career advice'],
        source: ['lib/geminiService.js', 'pages/api/career-advice.js'],
      }),
      createCandidateService('Trilhas de aprendizagem por profissão', 'career', {
        status: 'planned',
      }),
    ],
  },
  {
    id: 'intelligence',
    eyebrow: 'Informação',
    title: 'Serviços de informação e inteligência',
    lead: 'Muito úteis para retenção, leitura do mercado e acompanhamento do desempenho do candidato na plataforma.',
    services: [
      createCandidateService('Alertas personalizados por perfil', 'intelligence', {
        status: 'partial',
        dependencies: ['notifications', 'job matching'],
        source: ['pages/api/notifications.js', 'pages/api/notify-candidates.js'],
      }),
      createCandidateService('Recomendações de vagas por compatibilidade', 'intelligence', {
        featured: true,
        status: 'implemented',
        dependencies: ['recommendations', 'candidate signals'],
        source: ['pages/api/recommendations.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Estatísticas do perfil', 'intelligence', {
        planIds: ['unlimited_candidato'],
        status: 'implemented',
        dependencies: ['candidateProfileViews'],
        source: ['pages/api/candidate/plan-status.js', 'pages/dashboard/candidato/index.js'],
      }),
      createCandidateService('Saber quantas empresas viram o perfil', 'intelligence', {
        featured: true,
        planIds: ['unlimited_candidato'],
        status: 'implemented',
        dependencies: ['candidateProfileViews'],
        source: ['pages/api/candidate/plan-status.js', 'pages/dashboard/empresa/candidato/[id].js'],
      }),
      createCandidateService('Saber em que vagas tem maior compatibilidade', 'intelligence', {
        planIds: ['unlimited_candidato'],
        status: 'implemented',
        dependencies: ['job fit analysis'],
        source: ['lib/candidateOptimizationInsights.js', 'pages/dashboard/candidato/index.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Feedback sobre candidatura', 'intelligence', {
        status: 'implemented',
        planIds: ['basic_candidato', 'professional_candidato', 'unlimited_candidato'],
        dependencies: ['applications compatibility feedback'],
        source: ['pages/api/applications/index.js', 'pages/dashboard/candidato/candidaturas.js'],
      }),
      createCandidateService('Comparação do perfil com outros candidatos', 'intelligence', {
        planIds: ['unlimited_candidato'],
        status: 'planned',
      }),
    ],
  },
  {
    id: 'convenience',
    eyebrow: 'Conveniência',
    title: 'Serviços de conveniência',
    lead: 'Ferramentas para reduzir fricção, acelerar o uso e dar ao candidato uma experiência mais prática.',
    services: [
      createCandidateService('CV online editável', 'convenience', {
        status: 'partial',
        dependencies: ['profile editor', 'cv builder'],
        source: ['pages/dashboard/candidato/index.js', 'pages/recursos/gerador-cv.js'],
      }),
      createCandidateService('Modelos de CV', 'convenience', {
        status: 'implemented',
        dependencies: ['resources catalog'],
        source: ['lib/resourcesCatalog.js', 'pages/recursos.js'],
      }),
      createCandidateService('Geração de carta de motivação', 'convenience', {
        status: 'planned',
      }),
      createCandidateService('Perfil multilíngue', 'convenience', {
        status: 'planned',
      }),
      createCandidateService('Guardar documentos', 'convenience', {
        status: 'partial',
        dependencies: ['cv', 'certificates'],
        source: ['pages/api/profile/upload-cv.js', 'pages/api/profile/update.js'],
      }),
      createCandidateService('Portefólio digital', 'convenience', {
        status: 'partial',
        dependencies: ['website/profile links'],
        source: ['pages/api/profile/update.js'],
      }),
      createCandidateService('Integração com LinkedIn ou GitHub', 'convenience', {
        status: 'partial',
        dependencies: ['linkedin normalization'],
        source: ['lib/linkedin.js', 'pages/api/profile/update.js'],
      }),
      createCandidateService('Aplicação mobile ou notificações rápidas', 'convenience', {
        status: 'partial',
        planIds: ['professional_candidato', 'unlimited_candidato'],
        dependencies: ['web push'],
        source: ['components/WebPushManager.js', 'lib/serverNotifications.js'],
      }),
    ],
  },
  {
    id: 'revenue',
    eyebrow: 'Monetização',
    title: 'Serviços premium com maior potencial de receita',
    lead: 'Os serviços mais fortes para monetização combinam visibilidade, vantagem competitiva, inteligência e apoio profissional.',
    services: [
      createCandidateService('Candidaturas ilimitadas', 'revenue', {
        featured: true,
        status: 'implemented',
        source: ['lib/candidatePlanFeatures.js'],
      }),
      createCandidateService('Perfil em destaque', 'revenue', {
        featured: true,
        status: 'partial',
        dependencies: ['curriculoDestacado'],
        source: ['lib/candidatePlanFeatures.js'],
      }),
      createCandidateService('Candidato verificado', 'trust', {
        featured: true,
        status: 'implemented',
      }),
      createCandidateService('Ver quem viu o perfil', 'revenue', {
        status: 'implemented',
        dependencies: ['candidateProfileViews'],
        source: ['pages/api/candidate/plan-status.js'],
      }),
      createCandidateService('Acesso antecipado a vagas', 'revenue', {
        status: 'implemented',
        source: ['pages/api/jobs/index.js', 'pages/api/applications/index.js', 'pages/vaga/[id].js'],
      }),
      createCandidateService('Análise de CV', 'revenue', {
        status: 'planned',
      }),
      createCandidateService('Optimização do perfil', 'revenue', {
        status: 'planned',
      }),
      createCandidateService('Mentoria ou apoio profissional', 'revenue', {
        featured: true,
        status: 'planned',
      }),
      createCandidateService('Testes/certificações', 'revenue', {
        status: 'partial',
        dependencies: ['skillsAssessment', 'certificateFiles'],
        source: ['lib/skillsAssessment.js', 'pages/api/profile/update.js'],
      }),
      createCandidateService('Recomendações inteligentes', 'revenue', {
        status: 'implemented',
        dependencies: ['recommendations'],
        source: ['pages/api/recommendations.js'],
      }),
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

function toPlanLabel(planId) {
  return PLAN_LABELS[planId] || String(planId || '').trim();
}

function enrichService(service) {
  const statusMeta = CANDIDATE_SERVICE_STATUS_META[service.status] || CANDIDATE_SERVICE_STATUS_META.planned;

  return {
    ...service,
    plans: (service.planIds || []).map((planId) => toPlanLabel(planId)),
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
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

export function getCandidateServiceGroups() {
  return RAW_CANDIDATE_SERVICE_GROUPS.map((group) => ({
    ...group,
    services: group.services.map(enrichService),
  }));
}

export function summarizeCandidateServices(groups = getCandidateServiceGroups()) {
  const services = groups.flatMap((group) => group.services);

  return {
    totalServices: services.length,
    totalGroups: groups.length,
    totalFeatured: services.filter((service) => service.featured).length,
  };
}
