import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiHome,
  FiMinus,
  FiSearch,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import { getEmpresaPlanFeatures } from '../lib/empresaPlanFeatures';
import {
  fetchEmpresaPlans,
  getEmpresaPlanCatalog,
} from '../lib/empresaPlansCatalog';
import styles from '../styles/EmpresasStitchPage.module.css';

const COMPANY_PHOTOS = {
  collaboration: '/assets/fotos/sequencia-002-45.webp',
  professional: '/assets/fotos/sequencia-002-34.webp',
};

const RECRUITING_TOOLS = [
  'Publique oportunidades de emprego',
  'Receba e organize candidaturas',
  'Encontre candidatos por competências',
  'Aceda ao Banco de Talentos',
  'Envie mensagens diretamente aos candidatos',
  'Agende e acompanhe entrevistas',
  'Analise o desempenho das suas vagas',
  'Receba insights para melhorar os resultados',
  'Solicite apoio especializado de Recursos Humanos',
  'Destaque ou patrocine as suas oportunidades',
];

// Plano negociado com a equipa: não tem subscrição direta no catálogo.
const ENTERPRISE_PLAN = {
  name: 'Empresarial',
  description:
    'Para grandes empresas e organizações com elevado volume de recrutamento ou necessidades específicas.',
  features: [
    'Todas as funcionalidades do plano Ouro',
    'Vagas patrocinadas e campanhas de recrutamento à medida',
    'Pacotes de publicação personalizados',
    'Recrutamento e seleção completo',
    'Triagem de grandes volumes de candidaturas',
    'Consultoria de Recursos Humanos',
    'Relatórios personalizados',
    'Atendimento dedicado e condições para contratos anuais',
  ],
};

const SUPPORT_LABELS = {
  basic: 'Normal',
  email: 'Email',
  priority: 'Prioritário',
  vip: 'Prioritário',
};

// Linhas da comparação, lidas dos limites que o sistema aplica a cada plano
// (lib/empresaPlanFeatures.js) para a tabela nunca prometer mais do que isso.
const COMPARISON_ROWS = [
  {
    label: 'Vagas ativas',
    value: (features) => features.maxActiveJobs ?? 'Ilimitadas',
    enterprise: 'Ilimitadas',
  },
  {
    label: 'Vagas em destaque em simultâneo',
    value: (features) =>
      features.canHighlightJobs
        ? (features.maxHighlightedJobs ?? 'Todas')
        : false,
    enterprise: 'Personalizado',
  },
  {
    label: 'Contactos dos candidatos',
    value: (features) => features.canViewCandidateContact,
    enterprise: true,
  },
  {
    label: 'Registo de entrevistas',
    value: (features) => features.canScheduleInterviews,
    enterprise: true,
  },
  {
    label: 'Mensagens diretas',
    value: (features) => features.canSendDirectMessages,
    enterprise: true,
  },
  {
    label: 'Pesquisa por nome, competência e área',
    value: (features) => features.canUseAdvancedFilters,
    enterprise: true,
  },
  {
    label: 'Prioridade nas pesquisas',
    value: (features) => features.priorityInSearch,
    enterprise: true,
  },
  {
    label: 'Banco de Talentos completo',
    value: (features) => features.accessTalentPool,
    enterprise: true,
  },
  {
    label: 'Analytics das vagas',
    value: (features) => features.canAccessAnalytics,
    enterprise: true,
  },
  {
    label: 'Exportação de dados',
    value: (features) => features.canExportApplications,
    enterprise: true,
  },
  {
    label: 'Suporte',
    value: (features) => SUPPORT_LABELS[features.supportLevel] || 'Normal',
    enterprise: 'Dedicado',
  },
];

const VISIBILITY_PRODUCTS = [
  {
    title: 'Vaga em destaque',
    description:
      'A vaga ganha mais visibilidade dentro da listagem normal, com selo «Destaque», contorno diferenciado e melhor posição nos resultados.',
    prices: [
      { duration: '7 dias', price: '100 STD' },
      { duration: '30 dias', price: '300 STD' },
    ],
  },
  {
    title: 'Vaga patrocinada',
    description:
      'A vaga aparece numa área exclusiva no topo da página de vagas, separada das publicações normais, com o selo «Patrocinada» e o logótipo da empresa.',
    prices: [
      { duration: '7 dias', price: '250 STD' },
      { duration: '14 dias', price: '400 STD' },
      { duration: '30 dias', price: '750 STD' },
    ],
  },
];

const SPONSORSHIP_RULES = [
  'Selo «Patrocinada» sempre visível',
  'Período com data de início e de fim',
  'Só vagas ativas e aprovadas',
  'Ativação após confirmação do pagamento',
  'Lugares limitados por área',
  'O patrocínio não garante contratação',
];

const EXTRA_SERVICES = [
  { name: 'Triagem de candidatos', price: 'A partir de 500 STD' },
  { name: 'Avaliação curricular', price: 'Preço por processo' },
  { name: 'Entrevista técnica', price: 'Preço por candidato' },
  { name: 'Consultoria de recrutamento', price: 'Orçamento personalizado' },
  { name: 'Criação de descrição de vaga', price: 'A partir de 150 STD' },
  {
    name: 'Campanha especial de recrutamento',
    price: 'Orçamento personalizado',
  },
  { name: 'Pacote de várias vagas', price: 'Preço negociado' },
];

const HR_REQUEST_URL = '/dashboard/empresa?tab=hr-services';
const SPONSORSHIP_REQUEST_URL = `${HR_REQUEST_URL}&servico=patrocinio`;

function ComparisonValue({ value }) {
  if (value === true) {
    return (
      <span className={styles.compareYes}>
        <FiCheck aria-hidden="true" />
        <span className={styles.srOnly}>Incluído</span>
      </span>
    );
  }
  if (value === false || value === null || value === undefined) {
    return (
      <span className={styles.compareNo}>
        <FiMinus aria-hidden="true" />
        <span className={styles.srOnly}>Não incluído</span>
      </span>
    );
  }
  return value;
}

/**
 * @param {{
 *   companyPlans?: Array<{
 *     id: string;
 *     name: string;
 *     price: number;
 *     priceLabel: string;
 *     pricePeriodLabel?: string;
 *     description?: string;
 *     popular?: boolean;
 *     features: string[];
 *   }>;
 * }} props
 */
export default function EmpresasPage({ companyPlans = [] }) {
  return (
    <>
      <Head>
        <title>Ferramentas de Recrutamento Profissional | EmpregoSTP</title>
        <meta
          name="description"
          content="Ferramentas para empresas encontrarem, avaliarem e contratarem os melhores talentos em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.container}>
              <div className={styles.heroGrid}>
                <div className={styles.heroCopy}>
                  <span className={styles.heroEyebrow}>
                    EmpregoSTP para empresas
                  </span>
                  <h1 className={styles.heroTitle}>
                    Recrutamento
                    <br />
                    para empresas
                  </h1>
                  <p className={styles.heroLead}>
                    Contrate melhor. Com menos complexidade.
                  </p>
                  <p className={styles.heroText}>
                    Publique vagas, organize candidaturas e encontre
                    profissionais preparados para fazer a sua empresa avançar.
                  </p>

                  <div className={styles.heroActions}>
                    <Link
                      href="/dashboard/empresa/vaga/criar-vaga"
                      className={styles.primaryAction}
                    >
                      Publicar uma vaga
                      <FiArrowRight aria-hidden="true" />
                    </Link>
                    <Link href="/candidatos" className={styles.secondaryAction}>
                      <FiSearch aria-hidden="true" />
                      Procurar candidatos
                    </Link>
                  </div>

                  <div className={styles.heroAssurance}>
                    <span>
                      <FiCheck aria-hidden="true" />
                    </span>
                    Comece gratuitamente e escolha um plano quando precisar de
                    mais alcance.
                  </div>
                </div>

                <div className={styles.heroVisual}>
                  <div className={styles.heroVisualMain}>
                    <Image
                      src={COMPANY_PHOTOS.collaboration}
                      alt="Profissionais a colaborar num processo de recrutamento"
                      fill
                      priority
                      sizes="(max-width: 767px) 100vw, 52vw"
                      className={styles.heroVisualImage}
                    />
                    <div className={styles.heroVisualCaption}>
                      <span>Empresas que avançam</span>
                      <strong>Talento certo, no momento certo</strong>
                    </div>
                  </div>
                  <div className={styles.heroVisualDetail}>
                    <Image
                      src={COMPANY_PHOTOS.professional}
                      alt="Profissional em ambiente de trabalho"
                      fill
                      sizes="180px"
                      className={styles.heroVisualImage}
                    />
                  </div>
                  <div className={styles.heroVisualBadge} aria-hidden="true">
                    <span>RH</span>
                    <small>com mais clareza</small>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.plansSection} id="planos">
            <div className={styles.container}>
              <div className={styles.plansIntro}>
                <span className={styles.sectionEyebrow}>Planos flexíveis</span>
                <h2 className={styles.plansTitle}>Planos para empresas</h2>
                <p className={styles.plansSubtitle}>
                  Comece gratuitamente e faça upgrade quando precisar de mais
                  alcance, ferramentas avançadas ou apoio especializado.
                </p>
              </div>

              <div className={styles.plansGrid}>
                {companyPlans.map((plan) => {
                  const isPopular = Boolean(plan.popular);
                  const isFree = Number(plan.price) === 0;
                  return (
                    <article
                      key={plan.id}
                      className={`${styles.planCard} ${
                        isPopular ? styles.planCardPopular : ''
                      }`}
                    >
                      {isPopular ? (
                        <span className={styles.planBadge}>Mais escolhido</span>
                      ) : null}
                      <h3 className={styles.planName}>{plan.name}</h3>
                      <p className={styles.planPrice}>
                        {plan.priceLabel}
                        {plan.pricePeriodLabel ? (
                          <span className={styles.planPricePeriod}>
                            {plan.pricePeriodLabel}
                          </span>
                        ) : null}
                      </p>
                      <p className={styles.planDescription}>
                        {plan.description}
                      </p>
                      <ul className={styles.planFeatures}>
                        {plan.features.slice(0, 8).map((feature, index) => (
                          <li key={`${feature}-${index}`}>
                            <FiCheck aria-hidden="true" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={
                          isFree ? '/register?type=empresa' : '/premium/empresa'
                        }
                        className={styles.planAction}
                      >
                        {isFree
                          ? 'Começar gratuitamente'
                          : `Escolher plano ${plan.name}`}
                      </Link>
                    </article>
                  );
                })}
              </div>

              <article className={styles.enterpriseCard}>
                <div className={styles.enterpriseCopy}>
                  <h3 className={styles.planName}>{ENTERPRISE_PLAN.name}</h3>
                  <p className={styles.enterprisePrice}>Preço personalizado</p>
                  <p className={styles.planDescription}>
                    {ENTERPRISE_PLAN.description}
                  </p>
                  <Link href="/contacto" className={styles.enterpriseAction}>
                    Falar com a equipa
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </div>
                <ul className={styles.enterpriseFeatures}>
                  {ENTERPRISE_PLAN.features.map((feature) => (
                    <li key={feature}>
                      <FiCheck aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>

              <div className={styles.compareBlock}>
                <h3 className={styles.compareTitle} id="compare-title">
                  Compare os planos
                </h3>
                <div
                  className={styles.compareScroll}
                  role="region"
                  aria-labelledby="compare-title"
                  tabIndex={0}
                >
                  <table className={styles.compareTable}>
                    <thead>
                      <tr>
                        <th scope="col">Recurso</th>
                        {companyPlans.map((plan) => (
                          <th key={plan.id} scope="col">
                            {plan.name}
                          </th>
                        ))}
                        <th scope="col">{ENTERPRISE_PLAN.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Preço mensal</th>
                        {companyPlans.map((plan) => (
                          <td key={plan.id}>{plan.priceLabel}</td>
                        ))}
                        <td>Personalizado</td>
                      </tr>
                      {COMPARISON_ROWS.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          {companyPlans.map((plan) => (
                            <td key={plan.id}>
                              <ComparisonValue
                                value={row.value(
                                  getEmpresaPlanFeatures(
                                    plan.normalizedId || plan.id,
                                  ),
                                )}
                              />
                            </td>
                          ))}
                          <td>
                            <ComparisonValue value={row.enterprise} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section
            className={styles.toolkitSection}
            aria-labelledby="toolkit-title"
          >
            <div className={`${styles.container} ${styles.toolkitLayout}`}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Tudo numa só plataforma
                </span>
                <h2 id="toolkit-title" className={styles.plansTitle}>
                  Recrute melhor com a EmpregoSTP
                </h2>
                <p className={styles.plansSubtitle}>
                  Publique vagas, encontre candidatos e organize todo o seu
                  processo de recrutamento numa única plataforma. A EmpregoSTP
                  ajuda empresas de todos os tamanhos a contratar com mais
                  rapidez, organização e visibilidade.
                </p>
              </div>
              <ul className={styles.toolkitList}>
                {RECRUITING_TOOLS.map((tool) => (
                  <li key={tool}>
                    <FiCheck aria-hidden="true" />
                    {tool}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section
            className={styles.visibilitySection}
            aria-labelledby="visibility-title"
          >
            <div className={styles.container}>
              <div className={styles.plansIntro}>
                <span className={styles.sectionEyebrow}>Mais alcance</span>
                <h2 id="visibility-title" className={styles.plansTitle}>
                  Dê mais visibilidade às suas oportunidades
                </h2>
                <p className={styles.plansSubtitle}>
                  Com uma vaga em destaque ou patrocinada, a sua empresa alcança
                  mais candidatos em menos tempo, sem precisar de mudar de
                  plano.
                </p>
              </div>

              <div className={styles.visibilityGrid}>
                {VISIBILITY_PRODUCTS.map((product) => (
                  <article
                    key={product.title}
                    className={styles.visibilityCard}
                  >
                    <h3>{product.title}</h3>
                    <p>{product.description}</p>
                    <dl className={styles.priceList}>
                      {product.prices.map((entry) => (
                        <div key={entry.duration}>
                          <dt>{entry.duration}</dt>
                          <dd>{entry.price}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.closingSection}>
            <div className={styles.container}>
              <div className={styles.closingPanel}>
                <div>
                  <span className={styles.closingEyebrow}>
                    Comece gratuitamente
                  </span>
                  <h2>Encontre a próxima pessoa certa para a sua equipa.</h2>
                  <p>
                    Crie o perfil da sua empresa, publique a primeira vaga e
                    faça upgrade quando precisar de mais alcance, ferramentas
                    avançadas ou apoio especializado.
                  </p>
                </div>
                <Link
                  href="/register?type=empresa"
                  className={styles.closingAction}
                >
                  Criar conta de empresa
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          <section
            className={styles.extrasSection}
            aria-label="Regras de patrocínio e serviços adicionais"
          >
            <div className={styles.container}>
              <div className={styles.servicesBlock}>
                <div>
                  <h3 className={styles.compareTitle}>Serviços adicionais</h3>
                  <p className={styles.plansSubtitle}>
                    Mesmo sem um plano mais elevado, pode contratar serviços
                    específicos à equipa da EmpregoSTP.
                  </p>
                  <Link href={HR_REQUEST_URL} className={styles.servicesAction}>
                    Pedir um serviço
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </div>
                <dl className={styles.servicesList}>
                  {EXTRA_SERVICES.map((service) => (
                    <div key={service.name}>
                      <dt>{service.name}</dt>
                      <dd>{service.price}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className={styles.rulesPanel}>
                <div>
                  <h3>Regras das vagas patrocinadas</h3>
                  <ul className={styles.rulesList}>
                    {SPONSORSHIP_RULES.map((rule) => (
                      <li key={rule}>
                        <FiCheck aria-hidden="true" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href={SPONSORSHIP_REQUEST_URL}
                  className={styles.closingAction}
                >
                  Patrocinar uma vaga
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          <nav className={styles.mobileBottomNav} aria-label="Navegação rápida">
            <Link href="/empresas" aria-current="page">
              <FiHome aria-hidden="true" />
              <span>Empresas</span>
            </Link>
            <Link href="/vagas">
              <FiBriefcase aria-hidden="true" />
              <span>Vagas</span>
            </Link>
            <Link href="/candidatos">
              <FiUsers aria-hidden="true" />
              <span>Candidatos</span>
            </Link>
            <Link href="/dashboard">
              <FiUser aria-hidden="true" />
              <span>Painel</span>
            </Link>
          </nav>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps() {
  try {
    const { admin } = await import('../lib/firebaseAdmin');
    const sourcePlans = await fetchEmpresaPlans(admin);

    return {
      props: {
        companyPlans: getEmpresaPlanCatalog(sourcePlans),
      },
    };
  } catch (error) {
    console.error('Erro ao carregar planos empresariais públicos:', error);
    return {
      props: {
        companyPlans: getEmpresaPlanCatalog([]),
      },
    };
  }
}
