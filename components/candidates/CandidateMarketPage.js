import Head from 'next/head';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiCompass,
  FiFileText,
  FiGlobe,
  FiMessageCircle,
  FiMapPin,
  FiShield,
  FiTarget,
  FiUsers,
} from 'react-icons/fi';
import PublicPageShell from '../PublicPageShell';
import VerifiedCandidatesCarousel from '../home/VerifiedCandidatesCarousel';
import { getCandidateMarketingPlans } from '../../lib/candidateCatalog';
import styles from '../../styles/CandidatosStitchPage.module.css';

// Verification is a service, not a subscription tier, so it is excluded from
// the plans grid. It stays available through the verification service/flow.
const CANDIDATE_MARKETING_PLANS = getCandidateMarketingPlans({
  includeVerification: false,
});

const NATIONAL_OFFERS = [
  {
    id: 'perfil-profissional-local',
    category: 'Posicionamento',
    title: 'Perfil profissional para o mercado nacional',
    description:
      'Apresente experiência, formação e competências com a clareza que as empresas locais procuram.',
    highlights: ['Visibilidade local', 'Perfil estruturado', 'Mais confiança'],
    plans: ['Básico', 'Profissional', 'Premium'],
    href: '/register?type=candidate',
    cta: 'Criar perfil',
    featured: true,
    statusLabel: 'Disponível',
    statusTone: 'implemented',
    Icon: FiUsers,
  },
  {
    id: 'vagas-nacionais',
    category: 'Oportunidades',
    title: 'Candidaturas a vagas em São Tomé e Príncipe',
    description:
      'Encontre oportunidades nacionais e acompanhe cada etapa da sua candidatura num só lugar.',
    highlights: [
      'Candidatura simples',
      'Acompanhamento claro',
      'Mais oportunidades',
    ],
    plans: ['Básico', 'Profissional', 'Premium'],
    href: '/vagas',
    cta: 'Explorar vagas',
    featured: false,
    statusLabel: 'Disponível',
    statusTone: 'implemented',
    Icon: FiBriefcase,
  },
  {
    id: 'verificacao-local',
    category: 'Credibilidade',
    title: 'Verificação para empregadores locais',
    description:
      'Reforce a confiança no seu perfil com validação de identidade, percurso e documentos profissionais.',
    highlights: [
      'Mais credibilidade',
      'Selo de confiança',
      'Perfil mais sólido',
    ],
    plans: ['Verificação', 'Premium'],
    href: '/dashboard/candidato?tab=verification',
    cta: 'Verificar perfil',
    featured: true,
    statusLabel: 'Disponível',
    statusTone: 'implemented',
    Icon: FiShield,
  },
  {
    id: 'cv-e-carta-local',
    category: 'Apresentação',
    title: 'CV e carta para o contexto nacional',
    description:
      'Crie materiais profissionais adaptados ao recrutamento local e às funções a que se candidata.',
    highlights: [
      'CV bem estruturado',
      'Carta personalizada',
      'Melhor apresentação',
    ],
    plans: ['Profissional', 'Premium'],
    href: '/recursos/gerador-cv',
    cta: 'Criar documentos',
    featured: false,
    statusLabel: 'Disponível',
    statusTone: 'implemented',
    Icon: FiFileText,
  },
  {
    id: 'alertas-regiao',
    category: 'Inteligência',
    title: 'Alertas por área e localização',
    description:
      'Receba oportunidades mais relevantes de acordo com a sua área, preferências e disponibilidade.',
    highlights: [
      'Alertas direcionados',
      'Menos ruído',
      'Decisões mais rápidas',
    ],
    plans: ['Premium'],
    href: '/dashboard/candidato',
    cta: 'Ativar alertas',
    featured: false,
    statusLabel: 'Em evolução',
    statusTone: 'partial',
    Icon: FiTarget,
  },
];

const INTERNATIONAL_OFFERS = [
  {
    id: 'expatriados',
    category: 'Chegada a STP',
    title: 'Preparação para trabalhar em São Tomé e Príncipe',
    description:
      'Planeie a sua procura de emprego e os passos essenciais para iniciar uma carreira em São Tomé e Príncipe.',
    highlights: ['Orientação para STP', 'Plano de chegada', 'Mais confiança'],
    plans: ['Profissional', 'Premium'],
    href: '/recursos',
    cta: 'Preparar percurso',
    featured: true,
    statusLabel: 'Disponível',
    statusTone: 'implemented',
    Icon: FiCompass,
  },
  {
    id: 'assistencia-residencia',
    category: 'Documentação',
    title: 'Visto, residência e documentos para STP',
    description:
      'Conheça os documentos e as etapas habituais para trabalhar e residir em São Tomé e Príncipe.',
    highlights: [
      'Documentos organizados',
      'Orientação prática',
      'Mais segurança',
    ],
    plans: ['Premium'],
    href: '/recursos',
    cta: 'Consultar orientação',
    featured: false,
    statusLabel: 'Orientação',
    statusTone: 'partial',
    Icon: FiFileText,
  },
  {
    id: 'creches-e-familia',
    category: 'Integração',
    title: 'Integração e planeamento da mudança',
    description:
      'Prepare a sua chegada, a adaptação ao país e os aspetos familiares ligados à mudança para STP.',
    highlights: ['Adaptação local', 'Apoio à chegada', 'Mudança planeada'],
    plans: ['Premium'],
    href: '/recursos',
    cta: 'Planear mudança',
    featured: false,
    statusLabel: 'Orientação',
    statusTone: 'partial',
    Icon: FiUsers,
  },
  {
    id: 'perfil-multilingue',
    category: 'Posicionamento',
    title: 'Perfil profissional para empregadores em STP',
    description:
      'Apresente a sua experiência internacional com um perfil e documentos adaptados ao mercado de trabalho são-tomense.',
    highlights: ['Perfil adaptado', 'Contexto local', 'Mais relevância'],
    plans: ['Profissional', 'Premium'],
    href: '/recursos/gerador-cv',
    cta: 'Adaptar perfil',
    featured: true,
    statusLabel: 'Disponível',
    statusTone: 'implemented',
    Icon: FiMessageCircle,
  },
  {
    id: 'recrutamento-internacional',
    category: 'Oportunidades',
    title: 'Vagas e candidaturas em São Tomé e Príncipe',
    description:
      'Explore oportunidades em STP e apresente candidaturas claras, relevantes e bem preparadas.',
    highlights: [
      'Empregadores em STP',
      'Candidaturas preparadas',
      'Oportunidades locais',
    ],
    plans: ['Profissional', 'Premium'],
    href: '/vagas',
    cta: 'Explorar oportunidades',
    featured: false,
    statusLabel: 'Disponível',
    statusTone: 'implemented',
    Icon: FiGlobe,
  },
];

const MARKET_CONFIGS = {
  national: {
    pageClass: 'nationalPage',
    eyebrow: 'Talento nacional',
    titleLead: 'Construa a sua carreira em São Tomé com mais',
    titleAccent: 'confiança.',
    titleTail: '',
    subtitle:
      'Encontre apoio para apresentar melhor o seu perfil, preparar candidaturas e chegar às oportunidades certas no mercado nacional.',
    primaryHref: '/vagas',
    primaryLabel: 'Explorar vagas',
    secondaryHref: '#planos',
    secondaryLabel: 'Comparar planos',
    assurance: 'Plano gratuito disponível, sem compromisso',
    catalogEyebrow: 'Escolha o seu próximo passo',
    catalogTitle: 'Como podemos ajudar a sua carreira?',
    catalogText:
      'Do primeiro perfil à candidatura, cada recurso foi organizado para reduzir fricção e aumentar a sua credibilidade.',
    visualLabel: 'São Tomé e Príncipe',
    visualCode: 'STP',
    offers: NATIONAL_OFFERS,
    ctaEyebrow: 'O seu próximo passo',
    ctaTitle: 'Transforme experiência em oportunidade.',
    ctaText:
      'Crie o seu perfil profissional e apresente-se ao mercado nacional com mais confiança.',
    ctaHref: '/register?type=candidate',
    ctaLabel: 'Criar perfil gratuito',
  },
  international: {
    pageClass: 'internationalPage',
    eyebrow: 'Talento internacional para STP',
    titleLead: 'Encontre o seu próximo emprego em',
    titleAccent: 'São Tomé e Príncipe.',
    titleTail: '',
    subtitle:
      'Se é um profissional de outro país e deseja trabalhar em São Tomé e Príncipe, prepare o seu perfil, documentos e candidaturas para o mercado local.',
    primaryHref: '/vagas',
    primaryLabel: 'Ver vagas em STP',
    secondaryHref: '#planos',
    secondaryLabel: 'Comparar planos',
    assurance:
      'Apoio para candidatos internacionais que querem trabalhar em STP',
    catalogEyebrow: 'Prepare a sua candidatura para STP',
    catalogTitle: 'O que precisa para trabalhar no país?',
    catalogText:
      'Organize o seu perfil, a documentação e a mudança para chegar ao mercado são-tomense com mais segurança.',
    visualLabel: 'Destino profissional',
    visualCode: 'STP',
    offers: INTERNATIONAL_OFFERS,
    ctaEyebrow: 'O seu próximo passo em STP',
    ctaTitle: 'Comece a construir a sua carreira em São Tomé e Príncipe.',
    ctaText:
      'Crie o seu perfil e apresente a sua experiência a empregadores do mercado são-tomense.',
    ctaHref: '/register?type=candidate',
    ctaLabel: 'Criar perfil para STP',
  },
};

function CandidateServiceCard({ service }) {
  const Icon = service.Icon;

  return (
    <article
      className={`${styles.serviceCard} ${service.featured ? styles.serviceCardFeatured : ''}`}
    >
      <div className={styles.serviceTopline}>
        <span className={styles.serviceIcon}>
          <Icon aria-hidden="true" />
        </span>
      </div>

      <p className={styles.serviceCategory}>{service.category}</p>
      <h3 className={styles.serviceTitle}>{service.title}</h3>
      <p className={styles.serviceDescription}>{service.description}</p>

      <div className={styles.serviceFooter}>
        <Link href={service.href} className={styles.serviceLinkButton}>
          {service.cta}
          <FiArrowRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function CandidatePlanCard({ plan }) {
  const isPopular = Boolean(plan.popular);
  const isFree = Number(plan.price) === 0;
  const isPremium = plan.id === 'unlimited_candidato';
  const titleId = `candidate-plan-${plan.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className={`${styles.candidatePlanCard} ${
        isPopular ? styles.candidatePlanPopular : ''
      } ${isPremium ? styles.candidatePlanPremium : ''}`}
    >
      <div className={styles.candidatePlanTopline}>
        <h3 id={titleId} className={styles.candidatePlanName}>
          {plan.name}
        </h3>
        {isPopular ? (
          <span className={styles.candidatePlanBadge}>Mais escolhido</span>
        ) : null}
      </div>

      <div className={styles.candidatePlanPrice}>
        <strong>{plan.priceLabel}</strong>
        <span>{isFree ? 'para começar' : '/ 30 dias'}</span>
      </div>

      <p className={styles.candidatePlanSummary}>{plan.summary}</p>

      <ul className={styles.candidatePlanFeatures}>
        {plan.features.slice(0, 5).map((feature) => (
          <li key={`${plan.id}-${feature}`}>
            <FiCheck aria-hidden="true" />
            <span>{feature === 'Upload de CV' ? 'Carregar CV' : feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={isFree ? '/register?type=candidate' : '/premium/candidatos'}
        className={styles.candidatePlanAction}
        aria-label={
          isFree
            ? `Criar perfil gratuito com o plano ${plan.name}`
            : `Escolher o plano ${plan.name}`
        }
      >
        {isFree ? 'Criar perfil gratuito' : 'Escolher este plano'}
        <FiArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

export default function CandidateMarketPage({
  market = 'national',
  verifiedCandidates = [],
}) {
  const config = MARKET_CONFIGS[market] || MARKET_CONFIGS.national;
  const isNational = market === 'national';

  return (
    <>
      <Head>
        <title>
          {isNational ? 'Candidatos Nacionais' : 'Candidatos Internacionais'}
          {' - EmpregoSTP'}
        </title>
        <meta name="description" content={config.subtitle} />
        <meta
          property="og:title"
          content={`${isNational ? 'Candidatos Nacionais' : 'Candidatos Internacionais'} - EmpregoSTP`}
        />
        <meta property="og:description" content={config.subtitle} />
        <meta property="og:type" content="website" />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={`${styles.page} ${styles[config.pageClass]}`}>
          <div className={styles.marketSwitchBar}>
            <nav
              className={styles.marketSwitch}
              aria-label="Catálogos de candidatos"
            >
              <Link
                href="/candidatos/nacional"
                className={`${styles.marketSwitchLink} ${isNational ? styles.marketSwitchLinkActive : ''}`}
                aria-current={isNational ? 'page' : undefined}
              >
                Talento Nacional
              </Link>
              <Link
                href="/candidatos/internacional"
                className={`${styles.marketSwitchLink} ${!isNational ? styles.marketSwitchLinkActive : ''}`}
                aria-current={!isNational ? 'page' : undefined}
              >
                Talento Internacional
              </Link>
            </nav>
          </div>

          <section className={styles.hero}>
            <div className={styles.container}>
              <div className={styles.heroGrid}>
                <div className={styles.heroCopy}>
                  <span className={styles.heroEyebrow}>{config.eyebrow}</span>
                  <h1 className={styles.heroTitle}>
                    {config.titleLead} <span>{config.titleAccent}</span>{' '}
                    {config.titleTail}
                  </h1>
                  <p className={styles.heroText}>{config.subtitle}</p>

                  <div className={styles.heroActions}>
                    <Link
                      href={config.primaryHref}
                      className={styles.primaryAction}
                    >
                      {config.primaryLabel}
                      <FiArrowRight aria-hidden="true" />
                    </Link>
                    <Link
                      href={config.secondaryHref}
                      className={styles.secondaryAction}
                    >
                      {config.secondaryLabel}
                    </Link>
                  </div>

                  <div className={styles.heroAssurance}>
                    <span>
                      <FiCheck aria-hidden="true" />
                    </span>
                    <p>{config.assurance}</p>
                  </div>
                </div>

                <div className={styles.marketVisual} aria-hidden="true">
                  <span className={`${styles.orbit} ${styles.orbitOuter}`} />
                  <span className={`${styles.orbit} ${styles.orbitMiddle}`} />
                  <span className={`${styles.orbit} ${styles.orbitInner}`} />
                  <span
                    className={`${styles.visualNode} ${styles.visualNodeOne}`}
                  >
                    CV
                  </span>
                  <span
                    className={`${styles.visualNode} ${styles.visualNodeTwo}`}
                  >
                    RH
                  </span>
                  <span
                    className={`${styles.visualNode} ${styles.visualNodeThree}`}
                  >
                    {isNational ? 'ST' : 'EU'}
                  </span>
                  <span
                    className={`${styles.visualNode} ${styles.visualNodeFour}`}
                  >
                    {isNational ? 'PR' : 'AF'}
                  </span>
                  <div className={styles.visualCenter}>
                    {isNational ? <FiMapPin /> : <FiGlobe />}
                    <strong>{config.visualCode}</strong>
                    <span>{config.visualLabel}</span>
                  </div>
                  <div className={styles.visualLegend}>
                    <span className={styles.legendPulse} />
                    Rede profissional ativa
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.catalogSection} id="servicos">
            <div className={styles.container}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>Carreira</span>
                  <h2 className={styles.sectionHeadingTitle}>
                    {config.catalogEyebrow}
                  </h2>
                </div>
                <p className={styles.sectionHeadingText}>
                  <strong>{config.catalogTitle}</strong> {config.catalogText}
                </p>
              </div>

              <div className={styles.servicesGrid}>
                {config.offers.map((service) => (
                  <CandidateServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          </section>

          <section className={styles.plansSection} id="planos">
            <div className={styles.container}>
              <div className={styles.plansHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>
                    Planos para candidatos
                  </span>
                  <h2>Compare os nossos planos</h2>
                </div>
                <p>
                  Escolha apenas o que precisa agora. Comece gratuitamente ou
                  aumente a sua visibilidade, credibilidade e número de
                  candidaturas quando fizer sentido para si.
                </p>
              </div>

              <div className={styles.candidatePlansGrid}>
                {CANDIDATE_MARKETING_PLANS.map((plan) => (
                  <CandidatePlanCard key={plan.id} plan={plan} />
                ))}
              </div>

              <p className={styles.plansNote}>
                Pode mudar de plano conforme os seus objetivos profissionais.
              </p>
            </div>
          </section>

          {verifiedCandidates.length ? (
            <section
              className={styles.talentSection}
              aria-labelledby="candidatos-verificados-title"
            >
              <div className={styles.container}>
                <div className={styles.talentHeading}>
                  <div>
                    <span className={styles.sectionEyebrow}>
                      Perfis verificados
                    </span>
                    <h2 id="candidatos-verificados-title">
                      Quem já está verificado no EmpregoSTP
                    </h2>
                    <p>
                      Profissionais com percurso confirmado pela nossa equipa.
                      Verifique o seu perfil e apareça também aqui, à frente de
                      quem contrata.
                    </p>
                  </div>
                  <Link href="/candidatos" className={styles.talentLink}>
                    Ver todos os perfis
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </div>

                <VerifiedCandidatesCarousel
                  candidates={verifiedCandidates}
                  variante="larga"
                />
              </div>
            </section>
          ) : null}

          <section className={styles.ctaSection}>
            <div className={styles.container}>
              <div className={styles.ctaPanel}>
                <div>
                  <span className={styles.ctaEyebrow}>{config.ctaEyebrow}</span>
                  <h2>{config.ctaTitle}</h2>
                  <p>{config.ctaText}</p>
                </div>
                <Link href={config.ctaHref} className={styles.ctaButton}>
                  {config.ctaLabel}
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
