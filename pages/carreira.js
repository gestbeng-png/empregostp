import Head from 'next/head';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiClock,
  FiEdit3,
  FiFileText,
  FiMonitor,
  FiSend,
  FiStar,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import styles from '../styles/CarreiraPage.module.css';

const icons = {
  arrow: <FiArrowRight aria-hidden="true" />,
  briefcase: <FiBriefcase aria-hidden="true" />,
  calendar: <FiCalendar aria-hidden="true" />,
  check: <FiCheck aria-hidden="true" />,
  clock: <FiClock aria-hidden="true" />,
  document: <FiFileText aria-hidden="true" />,
  laptop: <FiMonitor aria-hidden="true" />,
  lightbulb: <FiEdit3 aria-hidden="true" />,
  plane: <FiSend aria-hidden="true" />,
  star: <FiStar aria-hidden="true" />,
  trending: <FiTrendingUp aria-hidden="true" />,
  users: <FiUsers aria-hidden="true" />,
};

const SERVICES = [
  {
    id: 'coaching',
    icon: 'users',
    title: 'Coaching de carreira premium',
    description:
      'Sessões individuais com especialistas de recursos humanos para definir o seu percurso, otimizar o seu perfil e acelerar a sua carreira.',
    features: [
      'Diagnóstico de carreira',
      'Plano de ação personalizado',
      'Simulação de entrevista',
      'Revisão de LinkedIn',
      'Acompanhamento mensal',
    ],
    price: '150',
    priceNote: 'por sessão',
    popular: true,
    tone: 'toneBlue',
    cta: 'Agendar sessão',
  },
  {
    id: 'repatriacao',
    icon: 'plane',
    title: 'Apoio à repatriação',
    description:
      'Serviço completo para profissionais da diáspora que desejam regressar a STP com uma transição tranquila e ligações diretas.',
    features: [
      'Guia completo de mudança',
      'Equivalência de diplomas',
      'Assessoria fiscal',
      'Rede de contactos com empresas',
      'Apoio logístico',
    ],
    price: '300',
    priceNote: 'pacote completo',
    popular: false,
    tone: 'toneSky',
    cta: 'Solicitar consulta',
  },
  {
    id: 'executivo',
    icon: 'star',
    title: 'Recolocação executiva',
    description:
      'Acompanhamento premium para profissionais seniores: posicionamento estratégico, acesso a uma rede de liderança executiva e negociação.',
    features: [
      'Diagnóstico executivo',
      'Marca pessoal',
      'Preparação para conselhos de administração',
      'Negociação salarial',
      'Acesso exclusivo a vagas',
    ],
    price: '500',
    priceNote: 'programa completo',
    popular: false,
    tone: 'toneNavy',
    cta: 'Falar com especialista',
  },
  {
    id: 'freelancer',
    icon: 'laptop',
    title: 'Apoio ao freelancer',
    description:
      'Orientação completa sobre trabalho remoto internacional: abertura de atividade, impostos em STP e contratos seguros.',
    features: [
      'Guia fiscal digital',
      'Modelos de contrato',
      'Pagamentos internacionais',
      'Proteção legal',
      'Rede de contactos remota',
    ],
    price: '200',
    priceNote: 'consultoria completa',
    popular: false,
    tone: 'toneGreen',
    cta: 'Iniciar consultoria',
  },
  {
    id: 'branding',
    icon: 'lightbulb',
    title: 'Marca pessoal',
    description:
      'Construímos o seu posicionamento profissional com portefólio moderno, narrativa clara e presença digital forte.',
    features: [
      'Narrativa profissional',
      'Portefólio visual',
      'Perfil otimizado',
      'Estratégia de conteúdo',
      'Sessão fotográfica',
    ],
    price: '250',
    priceNote: 'pacote completo',
    popular: false,
    tone: 'toneBlue',
    cta: 'Montar portefólio',
  },
  {
    id: 'empresa',
    icon: 'briefcase',
    title: 'Recrutamento para empresas',
    description:
      'Serviço dedicado para empresas: apoio no recrutamento, triagem de candidatos e campanhas de atração de talentos.',
    features: [
      'Lista final qualificada',
      'Entrevistas guiadas',
      'Relatório final',
      'Suporte contínuo',
      'Marca empregadora',
    ],
    price: 'Sob consulta',
    priceNote: 'por vaga',
    popular: false,
    tone: 'toneNavy',
    cta: 'Solicitar proposta',
  },
];

const COURSES = [
  {
    id: 'c1',
    title: 'Dominando entrevistas de emprego',
    description:
      'Aprenda técnicas avançadas para se destacar em qualquer entrevista.',
    modules: 8,
    duration: '4h 30min',
    rating: 4.9,
    price: '49',
    tone: 'toneBlue',
    badge: 'Mais vendido',
  },
  {
    id: 'c2',
    title: 'CV e carta de motivação perfeitos',
    description: 'Crie documentos que captem a atenção dos recrutadores.',
    modules: 6,
    duration: '3h 15min',
    rating: 4.8,
    price: '39',
    tone: 'toneGreen',
    badge: null,
  },
  {
    id: 'c3',
    title: 'LinkedIn para profissionais',
    description:
      'Otimize o seu perfil e construa uma rede de contactos relevante.',
    modules: 5,
    duration: '2h 45min',
    rating: 4.7,
    price: '35',
    tone: 'toneSky',
    badge: 'Novo',
  },
  {
    id: 'c4',
    title: 'Negociação salarial',
    description: 'Aprenda a negociar salários e benefícios com confiança.',
    modules: 4,
    duration: '2h 00min',
    rating: 4.9,
    price: '45',
    tone: 'toneNavy',
    badge: null,
  },
];

const MENTORS = [
  {
    id: 'm1',
    name: 'Ana Costa',
    role: 'Diretora de recursos humanos',
    company: 'TechSTP',
    experience: '15 anos',
    sessions: 120,
    rating: 5.0,
    available: true,
  },
  {
    id: 'm2',
    name: 'Pedro Dias',
    role: 'Diretor executivo',
    company: 'StartUp STP',
    experience: '20 anos',
    sessions: 85,
    rating: 4.9,
    available: true,
  },
  {
    id: 'm3',
    name: 'Maria Santos',
    role: 'Gestora financeira',
    company: 'BancoSTP',
    experience: '12 anos',
    sessions: 95,
    rating: 4.8,
    available: false,
  },
];

const TESTIMONIALS = [
  {
    id: 't1',
    name: 'João Fernandes',
    role: 'Programador',
    text: 'O coaching de carreira mudou completamente a minha abordagem profissional. Consegui uma promoção em apenas três meses.',
  },
  {
    id: 't2',
    name: 'Carla Neves',
    role: 'Gestora de marketing',
    text: 'O serviço de repatriação foi fundamental para o meu regresso a STP. Tive apoio completo em todas as fases.',
  },
  {
    id: 't3',
    name: 'Miguel Santos',
    role: 'Freelancer',
    text: 'Com a consultoria para freelancers, consegui regularizar a minha situação fiscal e ampliar a minha carteira de clientes internacionais.',
  },
];

export default function CarreiraPage() {
  return (
    <>
      <Head>
        <title>Serviços de carreira | EmpregoSTP</title>
        <meta
          name="description"
          content="Serviços profissionais de desenvolvimento de carreira: coaching, mentoria, cursos online e apoio à repatriação em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroInner}>
              <div className={styles.heroBadge}>
                <span className={styles.heroBadgeIcon}>{icons.trending}</span>
                <span>Serviços de carreira</span>
              </div>
              <h1 className={styles.heroTitle}>
                Acelere a sua carreira com apoio profissional
              </h1>
              <p className={styles.heroSubtitle}>
                Coaching personalizado, cursos online e mentoria com
                especialistas. Invista no seu desenvolvimento profissional e
                alcance seus objetivos.
              </p>
            </div>
          </section>

          <section
            className={styles.metricsBand}
            aria-label="Resultados dos serviços de carreira"
          >
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <strong>500+</strong>
                <span>Profissionais acompanhados</span>
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
                    className={`${styles.serviceIcon} ${styles[service.tone]}`}
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
                        {typeof service.price === 'number' ||
                        !Number.isNaN(Number(service.price))
                          ? `€${service.price}`
                          : service.price}
                      </strong>
                      <span>{service.priceNote}</span>
                    </div>
                    <Link
                      href="/sobre-nos#contactos"
                      className={`${styles.serviceButton} ${styles[service.tone]}`}
                    >
                      {service.cta}
                    </Link>
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
                      className={`${styles.courseBadge} ${styles[course.tone]}`}
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
                    <Link
                      href="/sobre-nos#contactos"
                      className={styles.courseButton}
                    >
                      Pedir informações
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Mentoria</p>
                <h2 className={styles.sectionTitle}>Os nossos mentores</h2>
              </div>
              <p className={styles.sectionSubtitle}>
                Ligue-se a profissionais experientes de São Tomé e Príncipe.
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
                      <span>Avaliação</span>
                    </div>
                  </div>
                  <span
                    className={`${styles.mentorStatus} ${
                      mentor.available
                        ? styles.mentorStatusAvailable
                        : styles.mentorStatusUnavailable
                    }`}
                  >
                    {mentor.available ? 'Disponível' : 'Indisponível'}
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
                    O que dizem os nossos clientes
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
                <Link href="/sobre-nos#contactos" className={styles.ctaPrimary}>
                  Agendar consulta gratuita
                  <span className={styles.inlineIcon}>{icons.calendar}</span>
                </Link>
                <Link href="/recursos" className={styles.ctaSecondary}>
                  Ver recursos gratuitos
                  <span className={styles.inlineIcon}>{icons.arrow}</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
