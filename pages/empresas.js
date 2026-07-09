import Head from "next/head";
import Link from "next/link";
import {
  FiBarChart2,
  FiBriefcase,
  FiFilter,
  FiHome,
  FiShield,
  FiStar,
  FiTarget,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import PublicPageShell from "../components/PublicPageShell";
import { DEFAULT_EMPRESA_PLANS } from "../lib/defaultPlans";
import styles from "../styles/EmpresasPage.module.css";

const RECRUITMENT_TOOLS = [
  {
    title: "Perfil Institucional",
    description:
      "Cria um perfil completo da tua empresa com verificação oficial.",
    Icon: FiHome,
  },
  {
    title: "Publicação de Vagas",
    description:
      "Publica vagas em minutos com formulário intuitivo e templates profissionais.",
    Icon: FiZap,
  },
  {
    title: "Banco de Talentos",
    description:
      "Acede a uma base de candidatos qualificados e filtra por competências.",
    Icon: FiUsers,
  },
  {
    title: "Triagem Inteligente",
    description:
      "Filtra candidatos automaticamente com base nos requisitos da vaga.",
    Icon: FiFilter,
  },
  {
    title: "Match Automático",
    description:
      "A plataforma sugere os candidatos mais compatíveis com cada vaga.",
    Icon: FiTarget,
  },
  {
    title: "Relatórios",
    description:
      "Analisa o desempenho das vagas e o processo de recrutamento com dados reais.",
    Icon: FiBarChart2,
  },
  {
    title: "Destaque de Vagas",
    description:
      "Destaca as tuas vagas para aparecerem no topo das pesquisas.",
    Icon: FiStar,
  },
  {
    title: "Empresa Verificada",
    description:
      "Obtém o badge de empresa verificada e aumenta a confiança dos candidatos.",
    Icon: FiShield,
  },
  {
    title: "Serviço RH",
    description:
      "Recrutamento assistido por especialistas: triagem, shortlist, entrevistas, avaliação de competências e relatórios profissionais.",
    Icon: FiBriefcase,
  },
];

const COMPANY_STEPS = [
  {
    number: "01",
    title: "Cria o Perfil da Empresa",
    description:
      "Regista a tua empresa e obtém verificação oficial para aumentar a credibilidade.",
  },
  {
    number: "02",
    title: "Publica a Vaga",
    description:
      "Define os requisitos, responsabilidades e benefícios da posição em aberto.",
  },
  {
    number: "03",
    title: "Recebe Candidaturas",
    description:
      "A plataforma filtra e sugere os candidatos mais compatíveis automaticamente.",
  },
  {
    number: "04",
    title: "Avalia e Contrata",
    description:
      "Cria shortlists, agenda entrevistas e toma decisões informadas com dados reais.",
  },
];

const COMPANY_PLANS = DEFAULT_EMPRESA_PLANS.filter((plan) =>
  ["basic_empresa", "professional_empresa", "unlimited_empresa"].includes(plan.id),
);

export default function EmpresasPage() {
  return (
    <>
      <Head>
        <title>Ferramentas de Recrutamento Profissional | EmpregoSTP</title>
        <meta
          name="description"
          content="Ferramentas para empresas encontrarem, avaliarem e contratarem os melhores talentos em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell>
        <main className={styles.page}>
          <section className={styles.toolsSection}>
            <div className={styles.container}>
              <div className={styles.sectionIntro}>
                <h1 className={styles.title}>
                  Ferramentas de recrutamento profissional
                </h1>
                <p className={styles.subtitle}>
                  Tudo o que precisas para encontrar, avaliar e contratar os
                  melhores talentos.
                </p>
              </div>

              <div className={styles.toolsGrid}>
                {RECRUITMENT_TOOLS.map(({ title, description, Icon }) => (
                  <article key={title} className={styles.toolCard}>
                    <span className={styles.toolIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <h2 className={styles.toolTitle}>{title}</h2>
                    <p className={styles.toolDescription}>{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.stepsSection}>
            <div className={styles.container}>
              <h2 className={styles.stepsTitle}>Como funciona para empresas</h2>

              <div className={styles.stepsGrid}>
                {COMPANY_STEPS.map((step) => (
                  <article key={step.number} className={styles.stepCard}>
                    <span className={styles.stepNumber}>{step.number}</span>
                    <div>
                      <h3 className={styles.stepTitle}>{step.title}</h3>
                      <p className={styles.stepDescription}>{step.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.plansSection}>
            <div className={styles.container}>
              <div className={styles.plansIntro}>
                <h2 className={styles.plansTitle}>Planos para empresas</h2>
                <p className={styles.plansSubtitle}>
                  Escolhe o plano certo para publicar vagas, destacar
                  oportunidades e recrutar com mais eficiência.
                </p>
              </div>

              <div className={styles.plansGrid}>
                {COMPANY_PLANS.map((plan) => {
                  const isPopular = plan.id === "professional_empresa";
                  return (
                    <article
                      key={plan.id}
                      className={`${styles.planCard} ${
                        isPopular ? styles.planCardPopular : ""
                      }`}
                    >
                      {isPopular ? (
                        <span className={styles.planBadge}>Mais escolhido</span>
                      ) : null}
                      <h3 className={styles.planName}>{plan.name}</h3>
                      <p className={styles.planPrice}>{plan.priceLabel}</p>
                      <ul className={styles.planFeatures}>
                        {plan.features.slice(0, 6).map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                      <Link
                        href={
                          plan.price === 0
                            ? "/register?type=empresa"
                            : "/premium/empresa"
                        }
                        className={styles.planAction}
                      >
                        {plan.price === 0 ? "Começar grátis" : "Ver plano"}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </PublicPageShell>
    </>
  );
}
