import Head from "next/head";
import Link from "next/link";
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
} from "react-icons/fi";
import PublicPageShell from "../PublicPageShell";
import { getCandidateMarketingPlans } from "../../lib/candidateCatalog";
import styles from "../../styles/CandidatosPage.module.css";

// Verification is a service, not a subscription tier, so it is excluded from
// the plans grid. It stays available through the verification service/flow.
const CANDIDATE_MARKETING_PLANS = getCandidateMarketingPlans({
  includeVerification: false,
});

const NATIONAL_OFFERS = [
  {
    id: "perfil-profissional-local",
    category: "Posicionamento",
    title: "Perfil profissional para o mercado nacional",
    description:
      "Apresente experiência, formação e competências com a clareza que as empresas locais procuram.",
    highlights: ["Visibilidade local", "Perfil estruturado", "Mais confiança"],
    plans: ["Básico", "Profissional", "Premium"],
    href: "/register?type=candidate",
    cta: "Criar perfil",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    Icon: FiUsers,
  },
  {
    id: "vagas-nacionais",
    category: "Oportunidades",
    title: "Candidaturas a vagas em São Tomé e Príncipe",
    description:
      "Encontre oportunidades nacionais e acompanhe cada etapa da sua candidatura num só lugar.",
    highlights: ["Candidatura simples", "Acompanhamento claro", "Mais oportunidades"],
    plans: ["Básico", "Profissional", "Premium"],
    href: "/vagas",
    cta: "Explorar vagas",
    featured: false,
    statusLabel: "Disponível",
    statusTone: "implemented",
    Icon: FiBriefcase,
  },
  {
    id: "verificacao-local",
    category: "Credibilidade",
    title: "Verificação para empregadores locais",
    description:
      "Reforce a confiança no seu perfil com validação de identidade, percurso e documentos profissionais.",
    highlights: ["Mais credibilidade", "Selo de confiança", "Perfil mais sólido"],
    plans: ["Verificação", "Premium"],
    href: "/dashboard/candidato?tab=verification",
    cta: "Verificar perfil",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    Icon: FiShield,
  },
  {
    id: "cv-e-carta-local",
    category: "Apresentação",
    title: "CV e carta para o contexto nacional",
    description:
      "Crie materiais profissionais adaptados ao recrutamento local e às funções a que se candidata.",
    highlights: ["CV bem estruturado", "Carta personalizada", "Melhor apresentação"],
    plans: ["Profissional", "Premium"],
    href: "/recursos/gerador-cv",
    cta: "Criar documentos",
    featured: false,
    statusLabel: "Disponível",
    statusTone: "implemented",
    Icon: FiFileText,
  },
  {
    id: "alertas-regiao",
    category: "Inteligência",
    title: "Alertas por área e localização",
    description:
      "Receba oportunidades mais relevantes de acordo com a sua área, preferências e disponibilidade.",
    highlights: ["Alertas direcionados", "Menos ruído", "Decisões mais rápidas"],
    plans: ["Premium"],
    href: "/dashboard/candidato",
    cta: "Ativar alertas",
    featured: false,
    statusLabel: "Em evolução",
    statusTone: "partial",
    Icon: FiTarget,
  },
];

const INTERNATIONAL_OFFERS = [
  {
    id: "expatriados",
    category: "Mobilidade",
    title: "Preparação para trabalhar no exterior",
    description:
      "Organize a sua estratégia profissional para procurar oportunidades fora de São Tomé e Príncipe.",
    highlights: ["Orientação internacional", "Plano de preparação", "Mais confiança"],
    plans: ["Profissional", "Premium"],
    href: "/recursos",
    cta: "Preparar percurso",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    Icon: FiCompass,
  },
  {
    id: "assistencia-residencia",
    category: "Documentação",
    title: "Residência, visto e documentos essenciais",
    description:
      "Compreenda os documentos e próximos passos habituais para processos de trabalho e residência.",
    highlights: ["Documentos organizados", "Orientação prática", "Mais segurança"],
    plans: ["Premium"],
    href: "/recursos",
    cta: "Consultar orientação",
    featured: false,
    statusLabel: "Orientação",
    statusTone: "partial",
    Icon: FiFileText,
  },
  {
    id: "creches-e-familia",
    category: "Integração",
    title: "Planeamento familiar e integração",
    description:
      "Prepare aspetos familiares e de adaptação que influenciam uma mudança profissional internacional.",
    highlights: ["Suporte familiar", "Mais estabilidade", "Planeamento consciente"],
    plans: ["Premium"],
    href: "/recursos",
    cta: "Planear mudança",
    featured: false,
    statusLabel: "Orientação",
    statusTone: "partial",
    Icon: FiUsers,
  },
  {
    id: "perfil-multilingue",
    category: "Posicionamento",
    title: "Perfil multilingue para mercados externos",
    description:
      "Adapte o seu perfil e os seus documentos ao tom esperado por recrutadores internacionais.",
    highlights: ["Perfil adaptado", "Comunicação global", "Mais alcance"],
    plans: ["Profissional", "Premium"],
    href: "/recursos/gerador-cv",
    cta: "Adaptar perfil",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    Icon: FiMessageCircle,
  },
  {
    id: "recrutamento-internacional",
    category: "Oportunidades",
    title: "Recrutamento e candidaturas internacionais",
    description:
      "Explore oportunidades externas com uma candidatura mais clara, relevante e preparada.",
    highlights: ["Mercados externos", "Candidaturas preparadas", "Maior alcance"],
    plans: ["Profissional", "Premium"],
    href: "/vagas",
    cta: "Explorar oportunidades",
    featured: false,
    statusLabel: "Disponível",
    statusTone: "implemented",
    Icon: FiGlobe,
  },
];

const MARKET_CONFIGS = {
  national: {
    pageClass: "nationalPage",
    eyebrow: "Talento nacional",
    titleLead: "Construa a sua carreira",
    titleAccent: "em São Tomé",
    titleTail: "com mais confiança.",
    subtitle:
      "Encontre apoio para apresentar melhor o seu perfil, preparar candidaturas e chegar às oportunidades certas no mercado nacional.",
    primaryHref: "#planos",
    primaryLabel: "Comparar planos",
    secondaryHref: "/vagas",
    secondaryLabel: "Explorar vagas",
    assurance: "Plano gratuito disponível, sem compromisso",
    catalogEyebrow: "Escolha o seu próximo passo",
    catalogTitle: "Como podemos ajudar a sua carreira?",
    catalogText:
      "Do primeiro perfil à candidatura, cada recurso foi organizado para reduzir fricção e aumentar a sua credibilidade.",
    visualLabel: "São Tomé e Príncipe",
    visualCode: "STP",
    offers: NATIONAL_OFFERS,
    ctaEyebrow: "O seu próximo passo",
    ctaTitle: "Transforme experiência em oportunidade.",
    ctaText:
      "Crie o seu perfil profissional e apresente-se ao mercado nacional com mais confiança.",
    ctaHref: "/register?type=candidate",
    ctaLabel: "Criar perfil gratuito",
  },
  international: {
    pageClass: "internationalPage",
    eyebrow: "Carreira internacional",
    titleLead: "Prepare a sua carreira",
    titleAccent: "para trabalhar",
    titleTail: "no exterior.",
    subtitle:
      "Organize o seu perfil, documentos e próximos passos para procurar oportunidades internacionais com mais clareza e segurança.",
    primaryHref: "#planos",
    primaryLabel: "Comparar planos",
    secondaryHref: "/recursos/gerador-cv",
    secondaryLabel: "Criar currículo",
    assurance: "Escolha o nível de apoio certo para o seu percurso",
    catalogEyebrow: "Escolha o seu próximo passo",
    catalogTitle: "O que precisa para avançar?",
    catalogText:
      "Organize o que apresenta, os documentos que precisa e a estratégia que leva consigo para novos mercados.",
    visualLabel: "Alcance internacional",
    visualCode: "GLOBAL",
    offers: INTERNATIONAL_OFFERS,
    ctaEyebrow: "Leve o seu talento mais longe",
    ctaTitle: "Prepare hoje a carreira que quer construir lá fora.",
    ctaText:
      "Comece pelo seu perfil e avance com uma apresentação profissional adaptada a mercados internacionais.",
    ctaHref: "/recursos/gerador-cv",
    ctaLabel: "Preparar perfil global",
  },
};

function CandidateServiceCard({ service }) {
  const Icon = service.Icon;

  return (
    <article
      className={`${styles.serviceCard} ${service.featured ? styles.serviceCardFeatured : ""}`}
    >
      <div className={styles.serviceTopline}>
        <span className={styles.serviceIcon}>
          <Icon aria-hidden="true" />
        </span>
        <span className={styles.serviceCategory}>{service.category}</span>
      </div>

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
  const isPremium = plan.id === "unlimited_candidato";

  return (
    <article
      className={`${styles.candidatePlanCard} ${
        isPopular ? styles.candidatePlanPopular : ""
      } ${isPremium ? styles.candidatePlanPremium : ""}`}
    >
      <div className={styles.candidatePlanTopline}>
        <span className={styles.candidatePlanName}>{plan.name}</span>
        {isPopular ? (
          <span className={styles.candidatePlanBadge}>Mais escolhido</span>
        ) : null}
      </div>

      <div className={styles.candidatePlanPrice}>
        <strong>{plan.priceLabel}</strong>
        <span>{isFree ? "para começar" : "/ 30 dias"}</span>
      </div>

      <p className={styles.candidatePlanSummary}>{plan.summary}</p>

      <ul className={styles.candidatePlanFeatures}>
        {plan.features.slice(0, 5).map((feature) => (
          <li key={`${plan.id}-${feature}`}>
            <FiCheck aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={isFree ? "/register?type=candidate" : "/premium/candidatos"}
        className={styles.candidatePlanAction}
      >
        {isFree ? "Criar perfil gratuito" : "Escolher este plano"}
        <FiArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

export default function CandidateMarketPage({ market = "national" }) {
  const config = MARKET_CONFIGS[market] || MARKET_CONFIGS.national;
  const isNational = market === "national";

  return (
    <>
      <Head>
        <title>
          {isNational ? "Candidatos Nacionais" : "Candidatos Internacionais"}
          {" - EmpregoSTP"}
        </title>
        <meta name="description" content={config.subtitle} />
        <meta
          property="og:title"
          content={`${isNational ? "Candidatos Nacionais" : "Candidatos Internacionais"} - EmpregoSTP`}
        />
        <meta property="og:description" content={config.subtitle} />
        <meta property="og:type" content="website" />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={`${styles.page} ${styles[config.pageClass]}`}>
          <section className={styles.hero}>
            <div className={styles.container}>
              <nav className={styles.marketSwitch} aria-label="Catálogos de candidatos">
                <Link
                  href="/candidatos/nacional"
                  className={`${styles.marketSwitchLink} ${isNational ? styles.marketSwitchLinkActive : ""}`}
                  aria-current={isNational ? "page" : undefined}
                >
                  <FiMapPin aria-hidden="true" />
                  Nacional
                </Link>
                <Link
                  href="/candidatos/internacional"
                  className={`${styles.marketSwitchLink} ${!isNational ? styles.marketSwitchLinkActive : ""}`}
                  aria-current={!isNational ? "page" : undefined}
                >
                  <FiGlobe aria-hidden="true" />
                  Internacional
                </Link>
              </nav>

              <div className={styles.heroGrid}>
                <div className={styles.heroCopy}>
                  <span className={styles.heroEyebrow}>{config.eyebrow}</span>
                  <h1 className={styles.heroTitle}>
                    {config.titleLead} <span>{config.titleAccent}</span>{" "}
                    {config.titleTail}
                  </h1>
                  <p className={styles.heroText}>{config.subtitle}</p>

                  <div className={styles.heroActions}>
                    <Link href={config.primaryHref} className={styles.primaryAction}>
                      {config.primaryLabel}
                      <FiArrowRight aria-hidden="true" />
                    </Link>
                    <Link href={config.secondaryHref} className={styles.secondaryAction}>
                      {config.secondaryLabel}
                    </Link>
                  </div>

                  <div className={styles.heroAssurance}>
                    <span><FiCheck aria-hidden="true" /></span>
                    <p>{config.assurance}</p>
                  </div>
                </div>

                <div className={styles.marketVisual} aria-hidden="true">
                  <span className={`${styles.orbit} ${styles.orbitOuter}`} />
                  <span className={`${styles.orbit} ${styles.orbitMiddle}`} />
                  <span className={`${styles.orbit} ${styles.orbitInner}`} />
                  <span className={`${styles.visualNode} ${styles.visualNodeOne}`}>CV</span>
                  <span className={`${styles.visualNode} ${styles.visualNodeTwo}`}>RH</span>
                  <span className={`${styles.visualNode} ${styles.visualNodeThree}`}>
                    {isNational ? "ST" : "EU"}
                  </span>
                  <span className={`${styles.visualNode} ${styles.visualNodeFour}`}>
                    {isNational ? "PR" : "AF"}
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

          <section className={styles.plansSection} id="planos">
            <div className={styles.container}>
              <div className={styles.plansHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>Planos para candidatos</span>
                  <h2>Escolha apenas o que precisa agora.</h2>
                </div>
                <p>
                  Comece gratuitamente ou aumente a sua visibilidade, credibilidade
                  e número de candidaturas quando fizer sentido para si.
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

          <section className={styles.catalogSection} id="servicos">
            <div className={styles.container}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>{config.catalogEyebrow}</span>
                  <h2 className={styles.sectionHeadingTitle}>{config.catalogTitle}</h2>
                </div>
                <p className={styles.sectionHeadingText}>{config.catalogText}</p>
              </div>

              <div className={styles.servicesGrid}>
                {config.offers.map((service) => (
                  <CandidateServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          </section>

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
