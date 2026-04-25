import Head from "next/head";
import Link from "next/link";
import PublicPageShell from "../components/PublicPageShell";
import styles from "../styles/EmpresasPage.module.css";

const IMPLEMENTED_SERVICES = [
  {
    id: "publicacao-vagas",
    category: "Base",
    title: "Publicação de vagas",
    description: "Crie e publique vagas diretamente no painel da empresa.",
    highlights: ["Publicação rápida", "Gestão centralizada"],
    plans: ["Básico", "Profissional", "PRO"],
    href: "/dashboard/empresa/vaga/criar-vaga",
    cta: "Criar vaga",
    featured: true,
  },
  {
    id: "gestao-candidaturas",
    category: "Base",
    title: "Gestão de candidaturas",
    description:
      "Acompanhe candidaturas, estados e decisões dentro do dashboard.",
    highlights: ["Pipeline ativo", "Leitura rápida"],
    plans: ["Básico", "Profissional", "PRO"],
    href: "/dashboard/empresa/vagas",
    cta: "Gerir candidaturas",
    featured: true,
  },
  {
    id: "visualizacao-perfis",
    category: "Triagem",
    title: "Visualização de perfis e CV",
    description:
      "Veja perfis públicos, informações do candidato e currículos enviados.",
    highlights: ["Perfis detalhados", "CV disponível"],
    plans: ["Básico", "Profissional", "PRO"],
    href: "/dashboard/empresa",
    cta: "Ver perfis",
  },
  {
    id: "agendamento-entrevistas",
    category: "Triagem",
    title: "Agendamento de entrevistas",
    description:
      "Marque entrevistas com candidatos dentro do fluxo de candidatura.",
    highlights: ["Agenda integrada", "Fluxo mais rápido"],
    plans: ["Profissional", "PRO"],
    href: "/dashboard/empresa/vagas",
    cta: "Abrir recrutamento",
  },
  {
    id: "exportacao-candidatos",
    category: "Automação",
    title: "Exportação de candidatos",
    description: "Exporte candidatos e dados de recrutamento em PDF ou Excel.",
    highlights: ["PDF e Excel", "Partilha rápida"],
    plans: ["Profissional", "PRO"],
    href: "/dashboard/empresa/vagas",
    cta: "Exportar dados",
  },
  {
    id: "empresa-verificada",
    category: "Confiança",
    title: "Empresa verificada",
    description:
      "A empresa pode solicitar verificação e ganhar mais confiança na plataforma.",
    highlights: ["Mais confiança", "Selo visível"],
    plans: ["Profissional", "PRO"],
    href: "/dashboard/empresa/profile",
    cta: "Ver perfil",
    verifiedRelated: true,
    featured: true,
  },
  {
    id: "perfil-empresa",
    category: "Marca",
    title: "Perfil institucional",
    description:
      "Personalize o perfil da empresa com descrição, contactos e identidade.",
    highlights: ["Marca da empresa", "Apresentação clara"],
    plans: ["Básico", "Profissional", "PRO"],
    href: "/dashboard/empresa/profile",
    cta: "Editar perfil",
  },
  {
    id: "banco-talentos",
    category: "Talento",
    title: "Candidatos verificados",
    description:
      "Consulte candidatos validados e perfis com melhor leitura para recrutamento.",
    highlights: ["Perfis validados", "Acesso rápido"],
    plans: ["Profissional", "PRO"],
    href: "/dashboard/empresa",
    cta: "Abrir banco",
    verifiedRelated: true,
  },
];

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
  if (plan === "PRO") return styles.planPro;
  if (plan === "Profissional") return styles.planProfessional;
  return styles.planBasic;
}

function CompanyServiceCard({ service }) {
  return (
    <article className={styles.serviceCard}>
      <div className={styles.serviceHeader}>
        <span className={styles.serviceCategory}>{service.category}</span>
        <div className={styles.serviceBadges}>
          {service.featured ? (
            <span className={styles.featuredBadge}>
              <SparkIcon className={styles.badgeIcon} />
              Destaque
            </span>
          ) : null}
          {service.verifiedRelated ? (
            <span className={styles.verifiedBadge}>
              <VerifiedIcon className={styles.badgeIcon} />
              Verificado
            </span>
          ) : null}
        </div>
      </div>

      <h2 className={styles.serviceTitle}>{service.title}</h2>
      <p className={styles.serviceDescription}>{service.description}</p>

      <ul className={styles.serviceHighlights}>
        {service.highlights.slice(0, 2).map((highlight) => (
          <li key={`${service.id}-${highlight}`}>{highlight}</li>
        ))}
      </ul>

      <div className={styles.planRow}>
        {service.plans.map((plan) => (
          <span
            key={`${service.id}-${plan}`}
            className={`${styles.planTag} ${normalizePlanTag(plan)}`}
          >
            {plan}
          </span>
        ))}
      </div>

      <Link href={service.href} className={styles.serviceLink}>
        {service.cta}
        <ArrowRightIcon className={styles.linkIcon} />
      </Link>
    </article>
  );
}

export default function EmpresasPage() {
  return (
    <>
      <Head>
        <title>Serviços para Empresas - EmpregoSTP</title>
        <meta
          name="description"
          content="Veja os principais serviços já disponíveis para empresas no EmpregoSTP."
        />
        <meta
          property="og:title"
          content="Serviços para Empresas - EmpregoSTP"
        />
        <meta property="og:type" content="website" />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <section className={styles.servicesSection}>
            <div className={styles.container}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>Já implementado</span>
                  <h2 className={styles.sectionTitle}>
                    Recursos disponíveis agora
                  </h2>
                </div>
              </div>

              <div className={styles.servicesGrid}>
                {IMPLEMENTED_SERVICES.map((service) => (
                  <CompanyServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
