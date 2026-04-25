import Head from "next/head";
import Link from "next/link";
import PublicPageShell from "../components/PublicPageShell";
import styles from "../styles/CarreiraPage.module.css";

const icons = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0014 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  plane: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  laptop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M2 20h20" />
    </svg>
  ),
  lightbulb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18h6M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A5.5 5.5 0 1 0 8.5 14c.76.76 1.23 1.52 1.41 2.5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

const SERVICES = [
  {
    id: "coaching",
    icon: "users",
    title: "Career Coaching Premium",
    description:
      "Sessões individuais com especialistas de RH para definir seu roadmap profissional, otimizar seu perfil e acelerar sua carreira.",
    features: [
      "Diagnóstico de carreira",
      "Plano de ação personalizado",
      "Simulação de entrevista",
      "Revisão de LinkedIn",
      "Acompanhamento mensal",
    ],
    price: "150",
    priceNote: "por sessão",
    popular: true,
    color: "#2057d7",
    cta: "Agendar sessão",
  },
  {
    id: "repatriacao",
    icon: "plane",
    title: "Apoio à repatriação",
    description:
      "Serviço completo para profissionais da diáspora que desejam regressar a STP com transição suave e conexões diretas.",
    features: [
      "Guia completo de mudança",
      "Equivalência de diplomas",
      "Assessoria fiscal",
      "Networking com empresas",
      "Suporte logístico",
    ],
    price: "300",
    priceNote: "pacote completo",
    popular: false,
    color: "#5fb8f5",
    cta: "Solicitar consulta",
  },
  {
    id: "executivo",
    icon: "star",
    title: "Recolocação executiva",
    description:
      "Acompanhamento premium para profissionais seniores: posicionamento estratégico, acesso a rede C-level e negociação.",
    features: [
      "Diagnóstico executivo",
      "Personal branding",
      "Preparação para boards",
      "Negociação salarial",
      "Acesso exclusivo a vagas",
    ],
    price: "500",
    priceNote: "programa completo",
    popular: false,
    color: "#1e2b4d",
    cta: "Falar com especialista",
  },
  {
    id: "freelancer",
    icon: "laptop",
    title: "Apoio ao freelancer",
    description:
      "Orientação completa sobre trabalho remoto internacional: abertura de atividade, impostos em STP e contratos seguros.",
    features: [
      "Guia fiscal digital",
      "Modelos de contrato",
      "Pagamentos internacionais",
      "Proteção legal",
      "Networking remoto",
    ],
    price: "200",
    priceNote: "consultoria completa",
    popular: false,
    color: "#3dbb7a",
    cta: "Iniciar consultoria",
  },
  {
    id: "branding",
    icon: "lightbulb",
    title: "Marca pessoal",
    description:
      "Construímos seu posicionamento profissional com portefólio moderno, narrativa clara e presença digital forte.",
    features: [
      "Storytelling profissional",
      "Portefólio visual",
      "Perfil otimizado",
      "Estratégia de conteúdo",
      "Sessão fotográfica",
    ],
    price: "250",
    priceNote: "pacote completo",
    popular: false,
    color: "#2057d7",
    cta: "Montar portefólio",
  },
  {
    id: "empresa",
    icon: "briefcase",
    title: "Recrutamento para empresas",
    description:
      "Serviço dedicado para empresas: apoio no recrutamento, triagem de candidatos e campanhas de atração de talentos.",
    features: [
      "Shortlist qualificada",
      "Entrevistas guiadas",
      "Relatório final",
      "Suporte contínuo",
      "Employer branding",
    ],
    price: "Sob consulta",
    priceNote: "por vaga",
    popular: false,
    color: "#1e2b4d",
    cta: "Solicitar proposta",
  },
];

const COURSES = [
  {
    id: "c1",
    title: "Dominando entrevistas de emprego",
    description:
      "Aprenda técnicas avançadas para se destacar em qualquer entrevista.",
    modules: 8,
    duration: "4h 30min",
    rating: 4.9,
    price: "49",
    color: "#2057d7",
    badge: "Mais vendido",
  },
  {
    id: "c2",
    title: "CV e carta de motivação perfeitos",
    description: "Crie documentos que chamam atenção dos recrutadores.",
    modules: 6,
    duration: "3h 15min",
    rating: 4.8,
    price: "39",
    color: "#3dbb7a",
    badge: null,
  },
  {
    id: "c3",
    title: "LinkedIn para profissionais",
    description:
      "Otimize seu perfil e construa uma rede de contactos poderosa.",
    modules: 5,
    duration: "2h 45min",
    rating: 4.7,
    price: "35",
    color: "#5fb8f5",
    badge: "Novo",
  },
  {
    id: "c4",
    title: "Negociação salarial",
    description: "Aprenda a negociar salários e benefícios com confiança.",
    modules: 4,
    duration: "2h 00min",
    rating: 4.9,
    price: "45",
    color: "#1e2b4d",
    badge: null,
  },
];

const MENTORS = [
  {
    id: "m1",
    name: "Ana Costa",
    role: "HR Director",
    company: "TechSTP",
    experience: "15 anos",
    sessions: 120,
    rating: 5.0,
    available: true,
  },
  {
    id: "m2",
    name: "Pedro Dias",
    role: "CEO",
    company: "StartUp STP",
    experience: "20 anos",
    sessions: 85,
    rating: 4.9,
    available: true,
  },
  {
    id: "m3",
    name: "Maria Santos",
    role: "Finance Manager",
    company: "BancoSTP",
    experience: "12 anos",
    sessions: 95,
    rating: 4.8,
    available: false,
  },
];

const TESTIMONIALS = [
  {
    id: "t1",
    name: "João Fernandes",
    role: "Software Developer",
    text: "O coaching de carreira mudou completamente minha abordagem profissional. Consegui uma promoção em apenas 3 meses!",
  },
  {
    id: "t2",
    name: "Carla Neves",
    role: "Marketing Manager",
    text: "O serviço de repatriação foi fundamental para minha volta a STP. Apoio completo em todas as etapas.",
  },
  {
    id: "t3",
    name: "Miguel Santos",
    role: "Freelancer",
    text: "Com a consultoria para freelancers, consegui regularizar minha situação fiscal e expandir meus clientes internacionais.",
  },
];

export default function CarreiraPage() {
  return (
    <>
      <Head>
        <title>
          Serviços de Carreira | EmpregoSTP - Coaching, Cursos e Mentoria
        </title>
        <meta
          name="description"
          content="Serviços profissionais de desenvolvimento de carreira: coaching, mentoria, cursos online e apoio à repatriação em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <main className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroInner}>
              <div className={styles.heroBadge}>
                <span className={styles.heroBadgeIcon}>{icons.trending}</span>
                <span>Serviços de carreira</span>
              </div>
              <h1 className={styles.heroTitle}>
                Acelere sua carreira com apoio profissional
              </h1>
              <p className={styles.heroSubtitle}>
                Coaching personalizado, cursos online e mentoria com
                especialistas. Invista no seu desenvolvimento profissional e
                alcance seus objetivos.
              </p>
              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <strong>500+</strong>
                  <span>Profissionais atendidos</span>
                </div>
                <div className={styles.heroStat}>
                  <strong>95%</strong>
                  <span>Taxa de satisfação</span>
                </div>
                <div className={styles.heroStat}>
                  <strong>20+</strong>
                  <span>Mentores especialistas</span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Serviços</p>
                <h2 className={styles.sectionTitle}>Serviços premium</h2>
              </div>
              <p className={styles.sectionSubtitle}>
                Escolha o serviço ideal para o seu momento profissional.
              </p>
            </div>
            <div className={styles.servicesGrid}>
              {SERVICES.map((service) => (
                <article key={service.id} className={styles.serviceCard}>
                  {service.popular ? (
                    <span className={styles.popularBadge}>Mais popular</span>
                  ) : null}
                  <div
                    className={styles.serviceIcon}
                    style={{
                      "--service-icon-bg": `${service.color}18`,
                      "--service-icon-color": service.color,
                    }}
                  >
                    {icons[service.icon]}
                  </div>
                  <h3 className={styles.cardTitle}>{service.title}</h3>
                  <p className={styles.cardText}>{service.description}</p>
                  <ul className={styles.featureList}>
                    {service.features.slice(0, 4).map((feature) => (
                      <li key={feature} className={styles.featureItem}>
                        <span className={styles.featureIcon}>
                          {icons.check}
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.serviceFooter}>
                    <div className={styles.priceBlock}>
                      <strong>
                        {typeof service.price === "number" ||
                        !Number.isNaN(Number(service.price))
                          ? `€${service.price}`
                          : service.price}
                      </strong>
                      <span>{service.priceNote}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.serviceButton}
                      style={{ "--service-button": service.color }}
                    >
                      {service.cta}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles.section} ${styles.sectionAlt}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Cursos</p>
                <h2 className={styles.sectionTitle}>Cursos online</h2>
              </div>
              <p className={styles.sectionSubtitle}>
                Aprenda no seu ritmo com conteúdos gravados e práticos.
              </p>
            </div>
            <div className={styles.coursesGrid}>
              {COURSES.map((course) => (
                <article key={course.id} className={styles.courseCard}>
                  {course.badge ? (
                    <span
                      className={styles.courseBadge}
                      style={{
                        "--course-badge-bg": `${course.color}18`,
                        "--course-badge-color": course.color,
                      }}
                    >
                      {course.badge}
                    </span>
                  ) : null}
                  <h3 className={styles.cardTitle}>{course.title}</h3>
                  <p className={styles.cardText}>{course.description}</p>
                  <div className={styles.courseMeta}>
                    <span>
                      {icons.document}
                      {course.modules} módulos
                    </span>
                    <span>
                      {icons.clock}
                      {course.duration}
                    </span>
                    <span>
                      {icons.star}
                      {course.rating}
                    </span>
                  </div>
                  <div className={styles.courseFooter}>
                    <strong className={styles.coursePrice}>
                      €{course.price}
                    </strong>
                    <button type="button" className={styles.courseButton}>
                      Ver curso
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Mentoria</p>
                <h2 className={styles.sectionTitle}>Nossos mentores</h2>
              </div>
              <p className={styles.sectionSubtitle}>
                Conecte-se com profissionais experientes de São Tomé e Príncipe.
              </p>
            </div>
            <div className={styles.mentorsGrid}>
              {MENTORS.map((mentor) => (
                <article key={mentor.id} className={styles.mentorCard}>
                  <div className={styles.mentorAvatar}>{mentor.name[0]}</div>
                  <h3 className={styles.cardTitle}>{mentor.name}</h3>
                  <p className={styles.mentorRole}>{mentor.role}</p>
                  <p className={styles.mentorCompany}>{mentor.company}</p>
                  <div className={styles.mentorStats}>
                    <div>
                      <strong>{mentor.experience}</strong>
                      <span>Experiência</span>
                    </div>
                    <div>
                      <strong>{mentor.sessions}</strong>
                      <span>Sessões</span>
                    </div>
                    <div>
                      <strong>{mentor.rating}</strong>
                      <span>Rating</span>
                    </div>
                  </div>
                  <span
                    className={`${styles.mentorStatus} ${
                      mentor.available
                        ? styles.mentorStatusAvailable
                        : styles.mentorStatusUnavailable
                    }`}
                  >
                    {mentor.available ? "Disponível" : "Indisponível"}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.testimonialsWrap}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Prova social</p>
                  <h2 className={styles.sectionTitle}>
                    O que dizem nossos clientes
                  </h2>
                </div>
              </div>
              <div className={styles.testimonialsGrid}>
                {TESTIMONIALS.map((testimonial) => (
                  <article
                    key={testimonial.id}
                    className={styles.testimonialCard}
                  >
                    <p className={styles.testimonialText}>
                      &quot;{testimonial.text}&quot;
                    </p>
                    <div className={styles.testimonialAuthor}>
                      <div className={styles.testimonialAvatar}>
                        {testimonial.name[0]}
                      </div>
                      <div>
                        <p className={styles.testimonialName}>
                          {testimonial.name}
                        </p>
                        <p className={styles.testimonialRole}>
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.ctaBlock}>
              <h2 className={styles.ctaTitle}>
                Pronto para dar o próximo passo?
              </h2>
              <p className={styles.ctaText}>
                Agende uma consulta gratuita de 15 minutos para descobrir qual
                serviço é o ideal para o seu momento profissional.
              </p>
              <div className={styles.ctaActions}>
                <button type="button" className={styles.ctaPrimary}>
                  Agendar consulta gratuita
                  <span className={styles.inlineIcon}>{icons.calendar}</span>
                </button>
                <Link href="/recursos" className={styles.ctaSecondary}>
                  Ver recursos gratuitos
                  <span className={styles.inlineIcon}>{icons.arrow}</span>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </PublicPageShell>
    </>
  );
}
