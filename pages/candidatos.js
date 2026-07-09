import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import PublicPageShell from "../components/PublicPageShell";
import { getCandidateServiceGroups } from "../lib/candidateCatalog";
import styles from "../styles/CandidatosPage.module.css";

const NATIONAL_OFFERS = [
  {
    id: "perfil-profissional-local",
    category: "Nacional",
    title: "Perfil profissional local",
    description:
      "Crie um perfil forte para empresas locais, com experiência, formação e competências claras.",
    highlights: ["Visibilidade local", "Perfil estruturado", "Mais confiança"],
    plans: ["Básico", "Profissional", "Premium"],
    href: "/register?type=candidate",
    cta: "Criar perfil",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    verifiedRelated: false,
  },
  {
    id: "vagas-nacionais",
    category: "Nacional",
    title: "Candidatura a vagas nacionais",
    description:
      "Aplique a oportunidades em São Tomé e Príncipe e acompanhe cada estado da candidatura.",
    highlights: ["Candidaturas simples", "Acompanhamento claro", "Mais oportunidades"],
    plans: ["Básico", "Profissional", "Premium"],
    href: "/vagas",
    cta: "Ver vagas",
    featured: false,
    statusLabel: "Disponível",
    statusTone: "implemented",
    verifiedRelated: false,
  },
  {
    id: "verificacao-local",
    category: "Confiança",
    title: "Verificação para empregadores locais",
    description:
      "Aumente a confiança junto a empresas nacionais com verificação de perfil e documentos.",
    highlights: ["Mais credibilidade", "Mais respostas", "Perfil mais sólido"],
    plans: ["Verificação", "Premium"],
    href: "/dashboard/candidato?tab=verification",
    cta: "Verificar perfil",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    verifiedRelated: true,
  },
  {
    id: "cv-e-carta-local",
    category: "Posicionamento",
    title: "CV e carta de motivação para o mercado local",
    description:
      "Crie materiais profissionais adaptados ao contexto de recrutamento nacional.",
    highlights: ["CV pronto", "Carta personalizada", "Mais alinhamento"],
    plans: ["Profissional", "Premium"],
    href: "/recursos/gerador-cv",
    cta: "Abrir criador",
    featured: false,
    statusLabel: "Disponível",
    statusTone: "implemented",
    verifiedRelated: false,
  },
  {
    id: "alertas-regiao",
    category: "Inteligência",
    title: "Alertas por região e área",
    description:
      "Receba oportunidades com base na sua localização, setor e tipo de função.",
    highlights: ["Alertas por área", "Mais relevância", "Menos ruído"],
    plans: ["Premium"],
    href: "/dashboard/candidato",
    cta: "Ativar alertas",
    featured: false,
    statusLabel: "Parcial",
    statusTone: "partial",
    verifiedRelated: false,
  },
];

const INTERNATIONAL_OFFERS = [
  {
    id: "expatriados",
    category: "Internacional",
    title: "Apoio para expatriados",
    description:
      "Receba orientação prática para quem quer trabalhar fora de São Tomé e Príncipe.",
    highlights: ["Orientação internacional", "Preparação profissional", "Mais confiança"],
    plans: ["Profissional", "Premium"],
    href: "/recursos",
    cta: "Explorar recursos",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    verifiedRelated: false,
  },
  {
    id: "assistencia-residencia",
    category: "Internacional",
    title: "Auxílio para residência e visto",
    description:
      "Apoio para preparar documentos, informação e próximos passos de residência ou trabalho.",
    highlights: ["Documentos organizados", "Orientação útil", "Mais segurança"],
    plans: ["Premium"],
    href: "/recursos",
    cta: "Ver apoio",
    featured: false,
    statusLabel: "Parcial",
    statusTone: "partial",
    verifiedRelated: false,
  },
  {
    id: "creches-e-familia",
    category: "Integração",
    title: "Informação sobre creches e apoio à família",
    description:
      "Ajuda a compreender opções de creche, apoio familiar e necessidades de integração.",
    highlights: ["Suporte familiar", "Mais estabilidade", "Planeamento melhor"],
    plans: ["Premium"],
    href: "/recursos",
    cta: "Consultar apoio",
    featured: false,
    statusLabel: "Parcial",
    statusTone: "partial",
    verifiedRelated: false,
  },
  {
    id: "perfil-multilingue",
    category: "Internacional",
    title: "Perfil multilíngue e preparado para o mercado externo",
    description:
      "Prepare um perfil com linguagem adequada para empregadores internacionais e processos externos.",
    highlights: ["Perfil adaptado", "Mais alcance", "Mais oportunidades"],
    plans: ["Profissional", "Premium"],
    href: "/recursos/gerador-cv",
    cta: "Melhorar perfil",
    featured: true,
    statusLabel: "Disponível",
    statusTone: "implemented",
    verifiedRelated: false,
  },
  {
    id: "recrutamento-internacional",
    category: "Internacional",
    title: "Recrutamento internacional e oportunidades externas",
    description:
      "Acesso a oportunidades em mercados externos e orientação sobre candidatura internacional.",
    highlights: ["Oportunidades externas", "Preparação para candidaturas", "Mais alcance"],
    plans: ["Profissional", "Premium"],
    href: "/vagas",
    cta: "Explorar vagas",
    featured: false,
    statusLabel: "Disponível",
    statusTone: "implemented",
    verifiedRelated: false,
  },
];

const IMPLEMENTED_SERVICES = getCandidateServiceGroups()
  .flatMap((group) => group.services)
  .filter((service) => service.statusTone === "implemented")
  .sort((a, b) => Number(b.featured) - Number(a.featured))
  .slice(0, 12);

function SparkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 2l1.86 5.14L18 9l-5.14 1.86L11 16l-1.86-5.14L4 9l5.14-1.86L11 2z" />
      <path d="M18 14l.93 2.57L21.5 17.5l-2.57.93L18 21l-.93-2.57L14.5 17.5l2.57-.93L18 14z" />
    </svg>
  );
}

function VerifiedIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function normalizePlanTag(plan) {
  if (plan === "Premium" || plan === "Premium / Unlimited")
    return styles.planPremium;
  if (plan === "Profissional") return styles.planProfessional;
  if (plan === "Verificação") return styles.planVerification;
  return styles.planBasic;
}

function normalizeStatusTag(statusTone) {
  if (statusTone === "implemented") return styles.statusImplemented;
  if (statusTone === "partial") return styles.statusPartial;
  return styles.statusPlanned;
}

function compactDescription(service) {
  const text = String(service.description || "").trim();
  if (!text) return "";
  const [firstSentence] = text.split(". ");
  return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
}

function CandidateServiceCard({ service }) {
  return (
    <article className={styles.serviceCard}>
      <div className={styles.serviceHeader}>
        <span className={styles.serviceCategory}>{service.category}</span>
        <div className={styles.serviceBadges}>
          <span
            className={`${styles.serviceStatusBadge} ${normalizeStatusTag(service.statusTone)}`}
          >
            {service.statusLabel}
          </span>
          {service.featured ? (
            <span className={styles.servicePopularBadge}>
              <SparkIcon className={styles.badgeIcon} />
              Destaque
            </span>
          ) : null}
          {service.verifiedRelated ? (
            <span className={styles.serviceVerifiedBadge}>
              <VerifiedIcon className={styles.badgeIcon} />
              Verificado
            </span>
          ) : null}
        </div>
      </div>

      <h3 className={styles.serviceTitle}>{service.title}</h3>
      <p className={styles.serviceDescription}>{compactDescription(service)}</p>

      <ul className={styles.serviceFeatures}>
        {service.highlights.slice(0, 2).map((highlight) => (
          <li key={`${service.id}-${highlight}`}>{highlight}</li>
        ))}
      </ul>

      <div className={styles.serviceMeta}>
        {service.plans.map((plan) => (
          <span
            key={`${service.id}-${plan}`}
            className={`${styles.serviceMetaItem} ${normalizePlanTag(plan)}`}
          >
            {plan}
          </span>
        ))}
      </div>

      <Link href={service.href} className={styles.serviceLinkButton}>
        {service.cta}
        <ArrowRightIcon className={styles.linkIcon} />
      </Link>
    </article>
  );
}

export default function Candidatos() {
  const router = useRouter();
  const isInternational = router.query?.internacional !== undefined;
  const offers = isInternational ? INTERNATIONAL_OFFERS : NATIONAL_OFFERS;
  const pageTitle = isInternational
    ? "O que oferecemos para candidatos internacionais"
    : "O que oferecemos para candidatos nacionais";
  const pageEyebrow = isInternational ? "Internacional" : "Nacional";

  return (
    <>
      <Head>
        <title>Serviços para Candidatos - STP Emprego</title>
        <meta
          name="description"
          content="Veja os principais serviços já implementados para candidatos no STP Emprego."
        />
        <meta
          property="og:title"
          content="Serviços para Candidatos - STP Emprego"
        />
        <meta property="og:type" content="website" />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <section className={styles.contentSection}>
            <div className={styles.container}>
              <div className={styles.servicesSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.sectionEyebrow}>{pageEyebrow}</span>
                    <h2 className={styles.sectionHeadingTitle}>{pageTitle}</h2>
                  </div>
                </div>

                <div className={styles.servicesGrid}>
                  {offers.map((service) => (
                    <CandidateServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
