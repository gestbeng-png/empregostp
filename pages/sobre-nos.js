import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiSend,
} from 'react-icons/fi';
import {
  LuBuilding2,
  LuHandshake,
  LuHeartHandshake,
  LuLightbulb,
  LuScale,
  LuShieldCheck,
  LuSparkles,
  LuStar,
  LuTarget,
  LuUserRound,
} from 'react-icons/lu';
import PublicPageShell from '../components/PublicPageShell';
import CareerTeam from '../components/careers/CareerTeam';
import useScrollReveal from '../hooks/useScrollReveal';
import styles from '../styles/SobreNosPage.module.css';

const TESTIMONIAL_AUTOPLAY_MS = 4000;

const PHOTOS = '/assets/fotos';
const HERO_PHOTOS = {
  main: `${PHOTOS}/sequencia-002-68.webp`,
  float: `${PHOTOS}/sequencia-002-7.webp`,
};

const HERO_WORDS = [
  'Pessoas',
  'focadas',
  'em',
  'aproximar',
  { text: 'talento', accent: true },
  'e',
  { text: 'oportunidade', accent: true },
];

const VALUES = [
  {
    title: 'Igualdade de oportunidades',
    description: 'Promovemos o acesso justo ao emprego, sem discriminação.',
    Icon: LuScale,
  },
  {
    title: 'Transparência e confiança',
    description:
      'Valorizamos a honestidade, a credibilidade e a segurança de candidatos e empresas.',
    Icon: LuShieldCheck,
  },
  {
    title: 'Inovação',
    description:
      'Usamos a tecnologia para simplificar a procura de emprego e o recrutamento.',
    Icon: LuLightbulb,
  },
  {
    title: 'Valorização do talento',
    description:
      'Acreditamos nas competências e no potencial de cada profissional.',
    Icon: LuSparkles,
  },
  {
    title: 'Responsabilidade',
    description:
      'Trabalhamos com ética, rigor e compromisso com São Tomé e Príncipe.',
    Icon: LuHandshake,
  },
];

const AUDIENCES = [
  {
    title: 'Candidatos',
    description:
      'Acesso a oportunidades, ferramentas que valorizam o perfil e caminhos claros para crescer.',
    Icon: LuUserRound,
    tone: 'blue',
  },
  {
    title: 'Empresas',
    description:
      'Recrutamento simples, organizado e ligado a profissionais qualificados em São Tomé e Príncipe.',
    Icon: LuBuilding2,
    tone: 'navy',
  },
  {
    title: 'Comunidade',
    description:
      'Partilha de conhecimento, dicas de carreira e pontes que fortalecem o mercado de trabalho local.',
    Icon: LuHeartHandshake,
    tone: 'lime',
  },
];

const SEED_TESTIMONIALS = [
  {
    id: 'seed-1',
    name: 'Ana Trindade',
    role: 'Candidata · São Tomé',
    rating: 5,
    message:
      'Encontrei o meu primeiro emprego formal através do Emprego STP. O processo foi simples e recebi resposta em poucos dias.',
  },
  {
    id: 'seed-2',
    name: 'Nelson Costa',
    role: 'Gestor de Recursos Humanos',
    rating: 5,
    message:
      'Conseguimos preencher duas vagas técnicas com candidatos locais qualificados. A plataforma tornou o recrutamento muito mais claro.',
  },
];

function Stars({ value = 0 }) {
  return (
    <span
      className={styles.stars}
      role="img"
      aria-label={`${value} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((number) => (
        <LuStar
          key={number}
          className={number <= value ? styles.starActive : styles.starMuted}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function SobreNos() {
  const [testimonials, setTestimonials] = useState(SEED_TESTIMONIALS);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [testimonialPaused, setTestimonialPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState({
    name: '',
    role: '',
    rating: 0,
    message: '',
  });
  const [testimonialStatus, setTestimonialStatus] = useState(null);
  const [submittingTestimonial, setSubmittingTestimonial] = useState(false);
  const pageRef = useRef(null);
  useScrollReveal(pageRef);
  const handleTestimonialField = (field) => (event) => {
    const { value } = event.target;
    setTestimonialForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleTestimonialSubmit = async (event) => {
    event.preventDefault();
    if (submittingTestimonial) return;

    setTestimonialStatus(null);

    if (testimonialForm.name.trim().length < 2) {
      setTestimonialStatus({
        type: 'error',
        text: 'Indique o seu nome com pelo menos 2 caracteres.',
      });
      return;
    }

    if (testimonialForm.message.trim().length < 12) {
      setTestimonialStatus({
        type: 'error',
        text: 'O testemunho deve ter pelo menos 12 caracteres.',
      });
      return;
    }

    setSubmittingTestimonial(true);

    try {
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testimonialForm.name.trim(),
          role: testimonialForm.role.trim(),
          rating: testimonialForm.rating || undefined,
          message: testimonialForm.message.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível enviar o testemunho.');
      }

      setTestimonialStatus({
        type: 'success',
        text:
          data.message ||
          'Obrigado. O seu testemunho será publicado após revisão.',
      });
      setTestimonialForm({ name: '', role: '', rating: 0, message: '' });
    } catch (error) {
      setTestimonialStatus({
        type: 'error',
        text: error.message,
      });
    } finally {
      setSubmittingTestimonial(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetch('/api/testimonials')
      .then((response) =>
        response.ok ? response.json() : { testimonials: [] },
      )
      .then((data) => {
        if (cancelled) return;
        const approved = Array.isArray(data.testimonials)
          ? data.testimonials
          : [];

        if (approved.length) {
          setTestimonials([...SEED_TESTIMONIALS, ...approved]);
        }
      })
      .catch(() => {
        // Os testemunhos base mantêm a secção útil mesmo sem ligação à API.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const testimonialCount = testimonials.length;

  const goToTestimonial = useCallback(
    (index) => {
      setActiveTestimonial(() => {
        if (!testimonialCount) return 0;
        return (
          ((index % testimonialCount) + testimonialCount) % testimonialCount
        );
      });
    },
    [testimonialCount],
  );

  const showNextTestimonial = useCallback(() => {
    setActiveTestimonial((previous) =>
      testimonialCount ? (previous + 1) % testimonialCount : 0,
    );
  }, [testimonialCount]);

  const showPreviousTestimonial = useCallback(() => {
    setActiveTestimonial((previous) =>
      testimonialCount
        ? (previous - 1 + testimonialCount) % testimonialCount
        : 0,
    );
  }, [testimonialCount]);

  useEffect(() => {
    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    const updateMotionPreference = () => {
      setPrefersReducedMotion(motionPreference.matches);
    };

    updateMotionPreference();
    motionPreference.addEventListener('change', updateMotionPreference);

    return () => {
      motionPreference.removeEventListener('change', updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (testimonialPaused || prefersReducedMotion || testimonialCount <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(
      showNextTestimonial,
      TESTIMONIAL_AUTOPLAY_MS,
    );

    return () => window.clearInterval(intervalId);
  }, [
    activeTestimonial,
    prefersReducedMotion,
    showNextTestimonial,
    testimonialCount,
    testimonialPaused,
  ]);

  useEffect(() => {
    setActiveTestimonial((previous) =>
      previous >= testimonialCount ? 0 : previous,
    );
  }, [testimonialCount]);

  return (
    <>
      <Head>
        <title>Sobre nós | Emprego STP</title>
        <meta
          name="description"
          content="Conheça as pessoas que aproximam talento e oportunidades de emprego em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell>
        <div className={styles.page} ref={pageRef}>
          <div className={styles.pageContent}>
            <section className={styles.hero} aria-labelledby="about-title">
              <div className={styles.heroGlow} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={`${styles.container} ${styles.heroLayout}`}>
                <div className={styles.heroInner}>
                  <p className={styles.eyebrow}>
                    <span className={styles.pulse} aria-hidden="true" />
                    Quem somos
                  </p>
                  <h1 id="about-title" className={styles.heroTitle}>
                    {HERO_WORDS.map((word, index) => {
                      const text = typeof word === 'string' ? word : word.text;
                      return (
                        <Fragment key={text}>
                          <span
                            className={`${styles.word} ${
                              word.accent ? styles.wordAccent : ''
                            }`}
                            style={{ '--i': index }}
                          >
                            {text}
                          </span>{' '}
                        </Fragment>
                      );
                    })}
                  </h1>
                  <p className={styles.heroLead}>
                    Uma equipa pequena e dedicada, a construir a ponte entre
                    quem procura e quem contrata em São Tomé e Príncipe.
                    Nascemos para simplificar, modernizar e impulsionar o
                    mercado de trabalho.
                  </p>
                  <div className={styles.heroActions}>
                    <a href="#equipa" className={styles.heroPrimary}>
                      Conhecer a equipa
                      <FiArrowRight aria-hidden="true" />
                    </a>
                    <Link href="/vagas" className={styles.heroGhost}>
                      Explorar vagas
                    </Link>
                  </div>
                </div>

                <div className={styles.heroVisual} aria-hidden="true">
                  <div className={styles.heroPhotoMain}>
                    <Image
                      src={HERO_PHOTOS.main}
                      alt=""
                      fill
                      priority
                      sizes="(max-width: 64em) 90vw, 40vw"
                    />
                  </div>
                  <div className={styles.heroPhotoFloat}>
                    <Image src={HERO_PHOTOS.float} alt="" fill sizes="12rem" />
                  </div>
                  <div className={styles.heroChip}>
                    <span className={styles.chipDot} />
                    <span>
                      <strong>Feito em São Tomé e Príncipe</strong>
                      <small>Para quem procura e quem contrata</small>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={styles.missionSection}
              aria-labelledby="mission-title"
            >
              <div className={styles.container}>
                <div className={styles.missionCard} data-reveal>
                  <span className={styles.missionIcon} aria-hidden="true">
                    <LuTarget />
                  </span>
                  <div>
                    <h2 id="mission-title">A nossa missão</h2>
                    <p>
                      Conectar talento e oportunidade, tornando o mercado de
                      trabalho de São Tomé e Príncipe mais acessível,
                      transparente e eficiente através da tecnologia.
                    </p>
                  </div>
                </div>

                <h3 className={styles.valuesTitle} data-reveal>
                  Os nossos <span>valores</span>
                </h3>
                <ul className={styles.valuesGrid}>
                  {VALUES.map(({ title, description, Icon }, index) => (
                    <li
                      key={title}
                      className={styles.valueCard}
                      data-reveal
                      style={{ '--delay': `${index * 80}ms` }}
                    >
                      <span className={styles.valueIcon} aria-hidden="true">
                        <Icon />
                      </span>
                      <h4>{title}</h4>
                      <p>{description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section
              id="equipa"
              className={styles.teamSection}
              aria-labelledby="team-title"
            >
              <div className={styles.container}>
                <header className={styles.sectionHeader} data-reveal>
                  <p className={styles.kicker}>As pessoas</p>
                  <h2 id="team-title">A Nossa Equipa</h2>
                  <p>Conheça os rostos por trás da plataforma.</p>
                </header>

                <CareerTeam />

                <div className={styles.joinCta} data-reveal>
                  <p>
                    Quer construir connosco o futuro do emprego em São Tomé e
                    Príncipe?
                    <br />
                    Adorávamos conhecer o seu talento.
                  </p>
                  <Link href="/carreira" className={styles.joinButton}>
                    Junte-se à nossa equipa
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>

            <section
              className={styles.audienceSection}
              aria-labelledby="audience-title"
            >
              <div className={styles.container}>
                <header
                  className={`${styles.sectionHeader} ${styles.sectionHeaderCompact}`}
                  data-reveal
                >
                  <p className={styles.kicker}>Para quem</p>
                  <h2 id="audience-title">Uma plataforma para todos</h2>
                  <p>
                    Construída para ligar pessoas, empresas e conhecimento num
                    mercado de trabalho mais próximo e transparente.
                  </p>
                </header>

                <div className={styles.audienceGrid}>
                  {AUDIENCES.map(
                    ({ title, description, Icon, tone }, index) => (
                      <article
                        key={title}
                        className={styles.audienceCard}
                        data-reveal
                        style={{ '--delay': `${index * 90}ms` }}
                      >
                        <span
                          className={styles.audienceIcon}
                          data-tone={tone}
                          aria-hidden="true"
                        >
                          <Icon />
                        </span>
                        <div>
                          <h3>{title}</h3>
                          <p>{description}</p>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </div>
            </section>

            <section
              id="testemunhos"
              className={styles.testimonialsSection}
              aria-labelledby="testimonials-title"
            >
              <div className={styles.container}>
                <header
                  className={`${styles.sectionHeader} ${styles.sectionHeaderCompact}`}
                  data-reveal
                >
                  <p className={styles.kicker}>Testemunhos</p>
                  <h2 id="testimonials-title">O que dizem de nós</h2>
                  <p>
                    Experiências de candidatos e empresas que já encontraram
                    valor na plataforma.
                  </p>
                </header>

                {testimonialCount ? (
                  <div
                    className={styles.testimonialsCarousel}
                    role="region"
                    aria-roledescription="carrossel"
                    aria-label="Testemunhos de candidatos e empresas"
                    onMouseEnter={() => setTestimonialPaused(true)}
                    onMouseLeave={() => setTestimonialPaused(false)}
                    onFocusCapture={() => setTestimonialPaused(true)}
                    onBlurCapture={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setTestimonialPaused(false);
                      }
                    }}
                  >
                    <div className={styles.testimonialViewport}>
                      <div
                        className={styles.testimonialTrack}
                        style={{
                          transform: `translateX(-${activeTestimonial * 100}%)`,
                        }}
                      >
                        {testimonials.map((testimonial, index) => {
                          const isActive = index === activeTestimonial;

                          return (
                            <div
                              key={`${testimonial.id || testimonial.name}-${index}`}
                              className={styles.testimonialSlide}
                              data-testimonial-slide="true"
                              data-active={isActive ? 'true' : 'false'}
                              aria-hidden={!isActive}
                            >
                              <article className={styles.testimonialCard}>
                                <span
                                  className={styles.quoteMark}
                                  aria-hidden="true"
                                >
                                  &ldquo;
                                </span>
                                {testimonial.rating ? (
                                  <Stars value={testimonial.rating} />
                                ) : null}
                                <p className={styles.testimonialMessage}>
                                  {testimonial.message}
                                </p>
                                <div className={styles.testimonialAuthor}>
                                  <span
                                    className={styles.testimonialAvatar}
                                    aria-hidden="true"
                                  >
                                    {initialsOf(testimonial.name)}
                                  </span>
                                  <span className={styles.testimonialMeta}>
                                    <strong>{testimonial.name}</strong>
                                    {testimonial.role ? (
                                      <span>{testimonial.role}</span>
                                    ) : null}
                                  </span>
                                </div>
                              </article>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {testimonialCount > 1 ? (
                      <div className={styles.carouselControls}>
                        <button
                          type="button"
                          className={styles.carouselArrow}
                          onClick={showPreviousTestimonial}
                          aria-label="Testemunho anterior"
                        >
                          <FiChevronLeft aria-hidden="true" />
                        </button>
                        <div
                          className={styles.carouselDots}
                          role="group"
                          aria-label="Selecionar testemunho"
                        >
                          {testimonials.map((testimonial, index) => (
                            <button
                              type="button"
                              key={testimonial.id || testimonial.name}
                              className={`${styles.carouselDot} ${
                                index === activeTestimonial
                                  ? styles.carouselDotActive
                                  : ''
                              }`}
                              onClick={() => goToTestimonial(index)}
                              aria-label={`Ir para o testemunho ${index + 1}`}
                              aria-current={
                                index === activeTestimonial ? 'true' : undefined
                              }
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className={styles.carouselArrow}
                          onClick={showNextTestimonial}
                          aria-label="Testemunho seguinte"
                        >
                          <FiChevronRight aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className={styles.shareSection}
              aria-labelledby="share-title"
            >
              <div className={styles.container}>
                <div className={styles.shareLayout}>
                  <div className={styles.sharePitch} data-reveal>
                    <p className={styles.shareEyebrow}>Faça parte</p>
                    <h2 id="share-title">
                      Quer construir connosco o futuro do emprego em São Tomé e
                      Príncipe?
                    </h2>
                    <p>
                      Adorávamos conhecer a sua experiência. Faça parte do
                      movimento e impulsione a sua carreira connosco.
                    </p>
                    <div className={styles.shareActions}>
                      <Link
                        href="/register"
                        className={styles.sharePrimaryLink}
                      >
                        Criar conta
                        <FiArrowRight aria-hidden="true" />
                      </Link>
                      <Link href="/vagas" className={styles.shareSecondaryLink}>
                        Explorar vagas
                      </Link>
                    </div>
                  </div>

                  <form
                    className={styles.shareCard}
                    onSubmit={handleTestimonialSubmit}
                    data-reveal
                    style={{ '--delay': '120ms' }}
                  >
                    <div className={styles.shareCardHeader}>
                      <h3>Partilhe a sua experiência</h3>
                      <p>
                        O seu testemunho será revisto antes de ser publicado.
                      </p>
                    </div>

                    <label className={styles.field} htmlFor="testimonial-name">
                      <span>Nome</span>
                      <input
                        id="testimonial-name"
                        type="text"
                        value={testimonialForm.name}
                        onChange={handleTestimonialField('name')}
                        placeholder="O seu nome"
                        maxLength={60}
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className={styles.field} htmlFor="testimonial-role">
                      <span>Papel na comunidade</span>
                      <input
                        id="testimonial-role"
                        type="text"
                        value={testimonialForm.role}
                        onChange={handleTestimonialField('role')}
                        placeholder="Ex.: Candidata, recrutador ou empresa"
                        maxLength={80}
                      />
                    </label>

                    <fieldset className={styles.ratingFieldset}>
                      <legend>Avaliação</legend>
                      <div
                        className={styles.ratingPicker}
                        role="radiogroup"
                        aria-label="Avaliação"
                      >
                        {[1, 2, 3, 4, 5].map((number) => (
                          <button
                            key={number}
                            type="button"
                            role="radio"
                            className={`${styles.ratingButton} ${
                              number <= testimonialForm.rating
                                ? styles.ratingButtonActive
                                : ''
                            }`}
                            aria-label={`${number} estrela${
                              number > 1 ? 's' : ''
                            }`}
                            aria-checked={testimonialForm.rating === number}
                            onClick={() =>
                              setTestimonialForm((previous) => ({
                                ...previous,
                                rating: previous.rating === number ? 0 : number,
                              }))
                            }
                          >
                            <LuStar aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <label
                      className={styles.field}
                      htmlFor="testimonial-message"
                    >
                      <span>Testemunho</span>
                      <textarea
                        id="testimonial-message"
                        value={testimonialForm.message}
                        onChange={handleTestimonialField('message')}
                        placeholder="Conte-nos como foi a sua experiência com o Emprego STP."
                        rows={4}
                        maxLength={600}
                        required
                      />
                      <small>{testimonialForm.message.length}/600</small>
                    </label>

                    {testimonialStatus ? (
                      <p
                        className={`${styles.formStatus} ${
                          testimonialStatus.type === 'success'
                            ? styles.formStatusSuccess
                            : styles.formStatusError
                        }`}
                        role="status"
                      >
                        {testimonialStatus.text}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      className={styles.testimonialSubmit}
                      disabled={submittingTestimonial}
                    >
                      {submittingTestimonial ? 'A enviar...' : 'Enviar'}
                      {!submittingTestimonial ? (
                        <FiSend aria-hidden="true" />
                      ) : null}
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}
