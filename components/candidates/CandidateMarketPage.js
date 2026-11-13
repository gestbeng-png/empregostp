import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiCompass,
  FiFileText,
  FiGlobe,
  FiMessageCircle,
  FiShield,
  FiTarget,
  FiUsers,
} from 'react-icons/fi';
import PublicPageShell from '../PublicPageShell';
import VerifiedCandidatesCarousel from '../home/VerifiedCandidatesCarousel';
import CandidateActionLink, {
  CandidateActionProvider,
} from './CandidateActionLink';
import { getCandidateMarketingPlans } from '../../lib/candidateCatalog';
import styles from '../../styles/CandidatosStitchPage.module.css';

// Verification is a service, not a subscription tier, so it is excluded from
// the plans grid. It stays available through the verification service/flow.
const CANDIDATE_MARKETING_PLANS = getCandidateMarketingPlans({
  includeVerification: false,
});

// Derivados WebP (50–100 KB) das fotografias originais de 8–15 MB, que ficam
// fora do site em `private/fotos-originais` (não publicada). São fotografias
// diferentes das da home para as duas páginas não repetirem a mesma imagem.
const CANDIDATE_PHOTOS = {
  national: {
    main: '/assets/candidatos/hero-nacional.webp',
    mainAlt: 'Profissional de fato claro, de braços cruzados, num escritório',
    mainPosition: '50% 22%',
    detail: '/assets/candidatos/perfil-carreira.webp',
    detailAlt: 'Candidata ao computador, a olhar para a câmara',
    detailPosition: '55% 30%',
  },
  international: {
    main: '/assets/candidatos/hero-internacional.webp',
    mainAlt:
      'Profissional ao ar livre em São Tomé, a trabalhar num portátil junto a uma esplanada',
    mainPosition: '45% 30%',
    detail: '/assets/candidatos/documentos.webp',
    detailAlt: 'Profissional a organizar documentos num caderno',
    detailPosition: '50% 45%',
  },
  cta: '/assets/candidatos/equipa-cta.webp',
};

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
    titleLead: 'Descubra novas oportunidades em',
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

// A luz do cartão segue o cursor (posição guardada em variáveis CSS).
function trackSpotlight(event) {
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
  card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
}

function CandidateServiceCard({ service, index }) {
  const Icon = service.Icon;
  const ActionLink = ['/vagas', '/recursos'].includes(service.href)
    ? Link
    : CandidateActionLink;

  return (
    <article
      className={styles.serviceCard}
      style={{ '--card-index': index }}
      onPointerMove={trackSpotlight}
    >
      <span className={styles.serviceIcon}>
        <Icon aria-hidden="true" />
      </span>
      <p className={styles.serviceCategory}>{service.category}</p>
      <h3 className={styles.serviceTitle}>{service.title}</h3>
      <p className={styles.serviceDescription}>{service.description}</p>
      <ActionLink href={service.href} className={styles.serviceLinkButton}>
        {service.cta}
        <FiArrowRight aria-hidden="true" />
      </ActionLink>
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

      <CandidateActionLink
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
      </CandidateActionLink>
    </article>
  );
}

export default function CandidateMarketPage({
  market = 'national',
  verifiedCandidates = [],
}) {
  const config = MARKET_CONFIGS[market] || MARKET_CONFIGS.national;
  const isNational = market === 'national';
  const servicesRef = useRef(null);

  // Os cartões entram em sequência quando a secção aparece no ecrã. Sem
  // JavaScript, ou com movimento reduzido, ficam simplesmente visíveis.
  useEffect(() => {
    const grid = servicesRef.current;
    if (!grid || typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    grid.dataset.reveal = 'pending';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        grid.dataset.reveal = 'shown';
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, [market]);
  const photos = isNational
    ? CANDIDATE_PHOTOS.national
    : CANDIDATE_PHOTOS.international;

  // Uma só string: o React avisa quando <title> recebe vários filhos, porque
  // o browser trata tudo como texto e não há conversão garantida.
  const pageTitle = `${
    isNational ? 'Candidatos Nacionais' : 'Candidatos Internacionais'
  } - EmpregoSTP`;

  return (
    <CandidateActionProvider>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={config.subtitle} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={config.subtitle} />
        <meta property="og:type" content="website" />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={`${styles.page} ${styles[config.pageClass]}`}>
          <section className={styles.hero}>
            <div className={styles.container}>
              {/* O eyebrow e o seletor de mercado partilham a mesma linha;
                  o seletor fica por cima da foto. */}
              <div className={styles.heroTopRow}>
                <span className={styles.heroEyebrow}>{config.eyebrow}</span>
                <nav
                  className={styles.marketSwitch}
                  aria-label="Catálogos de candidatos"
                >
                  <Link
                    href="/candidatos/nacional"
                    className={`${styles.marketSwitchLink} ${isNational ? styles.marketSwitchLinkActive : ''}`}
                    aria-current={isNational ? 'page' : undefined}
                  >
                    Talento nacional
                  </Link>
                  <Link
                    href="/candidatos/internacional"
                    className={`${styles.marketSwitchLink} ${!isNational ? styles.marketSwitchLinkActive : ''}`}
                    aria-current={!isNational ? 'page' : undefined}
                  >
                    Talento internacional
                  </Link>
                </nav>
              </div>
              <div className={styles.heroGrid}>
                <div className={styles.heroCopy}>
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
                    {/* Âncora na mesma página: com `Link`, o servidor e o
                        browser resolviam `#planos` contra URLs diferentes
                        (`?internacional=` / `?internacional`) e a hidratação
                        falhava. */}
                    <a
                      href={config.secondaryHref}
                      className={styles.secondaryAction}
                    >
                      {config.secondaryLabel}
                    </a>
                  </div>

                  <div className={styles.heroAssurance}>
                    <span>
                      <FiCheck aria-hidden="true" />
                    </span>
                    <p>{config.assurance}</p>
                  </div>
                </div>

                <div className={styles.marketVisual}>
                  <div className={styles.marketVisualMain}>
                    <Image
                      src={photos.main}
                      alt={photos.mainAlt}
                      fill
                      priority
                      sizes="(max-width: 767px) 92vw, (max-width: 1023px) 50vw, 600px"
                      className={styles.marketVisualImage}
                      style={{ objectPosition: photos.mainPosition }}
                    />
                    <div className={styles.marketVisualCaption}>
                      <span>{config.visualLabel}</span>
                      <strong>
                        {isNational
                          ? 'Talento local'
                          : 'Experiência sem fronteiras'}
                      </strong>
                    </div>
                  </div>
                  <div className={styles.marketVisualDetail}>
                    <Image
                      src={photos.detail}
                      alt={photos.detailAlt}
                      fill
                      sizes="(max-width: 767px) 34vw, 200px"
                      className={styles.marketVisualImage}
                      style={{ objectPosition: photos.detailPosition }}
                    />
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

              <div className={styles.servicesGrid} ref={servicesRef}>
                {config.offers.map((service, index) => (
                  <CandidateServiceCard
                    key={service.id}
                    service={service}
                    index={index}
                  />
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
                <div
                  className={`${styles.talentHeading} ${styles.talentHeadingCentered}`}
                >
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
                </div>

                {/* Versão larga do carrossel: três cartões lado a lado. */}
                <div className={styles.talentCarousel}>
                  <VerifiedCandidatesCarousel
                    candidates={verifiedCandidates}
                    variante="larga"
                  />
                </div>

                <div className={styles.talentActions}>
                  <CandidateActionLink
                    href="/dashboard/candidato?tab=verification"
                    className={styles.talentPrimary}
                  >
                    Ser verificado
                    <FiArrowRight aria-hidden="true" />
                  </CandidateActionLink>
                  <Link href="/verificados" className={styles.talentLink}>
                    Ver mais perfis verificados
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <section className={styles.ctaSection}>
            <div className={styles.container}>
              <div className={styles.ctaPanel}>
                <div className={styles.ctaCopy}>
                  <span className={styles.ctaEyebrow}>{config.ctaEyebrow}</span>
                  <h2>{config.ctaTitle}</h2>
                  <p>{config.ctaText}</p>
                  <div className={styles.ctaActions}>
                    <CandidateActionLink
                      href={config.ctaHref}
                      className={styles.ctaButton}
                    >
                      {config.ctaLabel}
                      <FiArrowRight aria-hidden="true" />
                    </CandidateActionLink>
                    <Link
                      href="/verificados"
                      className={`${styles.ctaButton} ${styles.verifiedButton}`}
                    >
                      Perfís verificados
                      <FiArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                </div>
                <div className={styles.ctaMedia}>
                  <Image
                    src={CANDIDATE_PHOTOS.cta}
                    alt="Dois profissionais sorridentes, lado a lado, de braços cruzados"
                    fill
                    sizes="(max-width: 767px) 92vw, 420px"
                    className={styles.marketVisualImage}
                    style={{ objectPosition: '50% 16%' }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </CandidateActionProvider>
  );
}
