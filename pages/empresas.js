import Head from 'next/head';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiCheck,
  FiFilter,
  FiHome,
  FiSearch,
  FiShield,
  FiStar,
  FiTarget,
  FiUser,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import {
  fetchActiveEmpresaPlans,
  getEmpresaPlanCatalog,
} from '../lib/empresaPlansCatalog';
import styles from '../styles/EmpresasStitchPage.module.css';

const RECRUITMENT_TOOLS = [
  {
    title: 'Perfil institucional',
    description:
      'Crie um perfil completo da sua empresa com verificação oficial.',
    Icon: FiHome,
  },
  {
    title: 'Publicação de vagas',
    description:
      'Publique vagas em minutos com um formulário intuitivo e modelos profissionais.',
    Icon: FiZap,
  },
  {
    title: 'Banco de talentos',
    description:
      'Aceda a uma base de candidatos qualificados e filtre por competências.',
    Icon: FiUsers,
  },
  {
    title: 'Triagem inteligente',
    description:
      'Filtre candidatos automaticamente com base nos requisitos da vaga.',
    Icon: FiFilter,
  },
  {
    title: 'Sugestões automáticas',
    description:
      'A plataforma sugere os candidatos mais compatíveis com cada vaga.',
    Icon: FiTarget,
  },
  {
    title: 'Relatórios',
    description:
      'Analise o desempenho das vagas e o processo de recrutamento com dados reais.',
    Icon: FiBarChart2,
  },
  {
    title: 'Destaque de vagas',
    description:
      'Destaque as suas vagas para aparecerem no topo das pesquisas.',
    Icon: FiStar,
  },
  {
    title: 'Empresa verificada',
    description:
      'Obtenha o selo de empresa verificada e aumente a confiança dos candidatos.',
    Icon: FiShield,
  },
  {
    title: 'Serviço de RH',
    description:
      'Recrutamento assistido por especialistas: triagem, seleção, entrevistas, avaliação de competências e relatórios profissionais.',
    Icon: FiBriefcase,
  },
];

const COMPANY_STEPS = [
  {
    number: '01',
    title: 'Crie o perfil da empresa',
    description:
      'Registe a sua empresa e obtenha a verificação oficial para aumentar a credibilidade.',
  },
  {
    number: '02',
    title: 'Publique a vaga',
    description:
      'Define os requisitos, responsabilidades e benefícios da posição em aberto.',
  },
  {
    number: '03',
    title: 'Receba candidaturas',
    description:
      'A plataforma filtra e sugere os candidatos mais compatíveis automaticamente.',
  },
  {
    number: '04',
    title: 'Avalie e contrate',
    description:
      'Crie listas de candidatos, marque entrevistas e tome decisões informadas com dados reais.',
  },
];

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

                <div
                  className={styles.recruitmentPanel}
                  role="group"
                  aria-label="Exemplo do painel de recrutamento"
                >
                  <div className={styles.panelHeader}>
                    <div>
                      <span className={styles.panelKicker}>
                        Painel de recrutamento
                      </span>
                      <strong>Processo em curso</strong>
                    </div>
                    <span className={styles.liveBadge}>
                      <i /> Ativo
                    </span>
                  </div>

                  <div className={styles.jobSummary}>
                    <span className={styles.jobMark}>EM</span>
                    <div>
                      <strong>Especialista de marketing</strong>
                      <span>São Tomé · Tempo inteiro</span>
                    </div>
                    <span className={styles.applicationCount}>24</span>
                  </div>

                  <div className={styles.pipeline}>
                    <div className={styles.pipelineItem}>
                      <span>Recebidas</span>
                      <strong>24</strong>
                      <i>
                        <b />
                      </i>
                    </div>
                    <div className={styles.pipelineItem}>
                      <span>Seleção</span>
                      <strong>8</strong>
                      <i>
                        <b />
                      </i>
                    </div>
                    <div className={styles.pipelineItem}>
                      <span>Entrevistas</span>
                      <strong>3</strong>
                      <i>
                        <b />
                      </i>
                    </div>
                  </div>

                  <div className={styles.candidatePreview}>
                    <div className={styles.candidateAvatars} aria-hidden="true">
                      <span>AM</span>
                      <span>JM</span>
                      <span>LC</span>
                    </div>
                    <p>
                      <strong>3 candidatos</strong> prontos para entrevista
                    </p>
                    <FiArrowRight aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className={styles.valueStrip}
            aria-label="Benefícios principais"
          >
            <div className={`${styles.container} ${styles.valueGrid}`}>
              <div>
                <FiZap />
                <span>
                  <strong>Publicação simples</strong>Crie uma vaga em poucos
                  minutos
                </span>
              </div>
              <div>
                <FiTarget />
                <span>
                  <strong>Candidatos relevantes</strong>Filtre por perfil e
                  competências
                </span>
              </div>
              <div>
                <FiShield />
                <span>
                  <strong>Processo organizado</strong>Acompanhe cada candidatura
                </span>
              </div>
            </div>
          </section>

          <section className={styles.stepsSection}>
            <div className={styles.container}>
              <div className={styles.sectionIntro}>
                <span className={styles.sectionEyebrow}>Um processo claro</span>
                <h2 className={styles.stepsTitle}>Da vaga à contratação</h2>
                <p className={styles.subtitle}>
                  Quatro passos para transformar uma necessidade da equipa numa
                  contratação segura.
                </p>
              </div>

              <div className={styles.stepsGrid}>
                {COMPANY_STEPS.map((step) => (
                  <article key={step.number} className={styles.stepCard}>
                    <span className={styles.stepNumber}>{step.number}</span>
                    <div>
                      <h3 className={styles.stepTitle}>{step.title}</h3>
                      <p className={styles.stepDescription}>
                        {step.description}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.toolsSection}>
            <div className={styles.container}>
              <div className={styles.sectionIntro}>
                <span className={styles.sectionEyebrow}>Tudo num só lugar</span>
                <h2 className={styles.title}>
                  Ferramentas para contratar com confiança
                </h2>
                <p className={styles.subtitle}>
                  Da publicação à contratação, organize o processo sem perder
                  tempo entre ferramentas diferentes.
                </p>
              </div>

              <div
                className={styles.toolsGrid}
                role="region"
                aria-label="Ferramentas de recrutamento"
                tabIndex={0}
              >
                {RECRUITMENT_TOOLS.map(({ title, description, Icon }) => (
                  <article key={title} className={styles.toolCard}>
                    <span className={styles.toolIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <h3 className={styles.toolTitle}>{title}</h3>
                    <p className={styles.toolDescription}>{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.plansSection} id="planos">
            <div className={styles.container}>
              <div className={styles.plansIntro}>
                <span className={styles.sectionEyebrow}>Planos flexíveis</span>
                <h2 className={styles.plansTitle}>Planos para empresas</h2>
                <p className={styles.plansSubtitle}>
                  Escolha o plano certo para publicar vagas, destacar
                  oportunidades e recrutar com mais eficiência.
                </p>
              </div>

              <div className={styles.plansGrid}>
                {companyPlans.map((plan) => {
                  const isPopular = Boolean(plan.popular);
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
                          plan.price === 0
                            ? '/register?type=empresa'
                            : '/premium/empresa'
                        }
                        className={styles.planAction}
                      >
                        {plan.price === 0
                          ? 'Começar gratuitamente'
                          : 'Ver plano'}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={styles.closingSection}>
            <div className={styles.container}>
              <div className={styles.closingPanel}>
                <div>
                  <span className={styles.closingEyebrow}>
                    Pronto para recrutar?
                  </span>
                  <h2>Encontre a próxima pessoa certa para a sua equipa.</h2>
                  <p>
                    Crie a sua conta de empresa e publique a primeira
                    oportunidade.
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
    const sourcePlans = await fetchActiveEmpresaPlans(admin);

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
