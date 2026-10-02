import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiSend,
  FiX,
} from 'react-icons/fi';
import {
  LuBuilding2,
  LuGlobe,
  LuHeartHandshake,
  LuStar,
  LuTreePine,
  LuUserRound,
} from 'react-icons/lu';
import PublicPageShell from '../components/PublicPageShell';
import styles from '../styles/SobreNosPage.module.css';

const TESTIMONIAL_AUTOPLAY_MS = 4000;

const TEAM = [
  {
    name: 'Edmir dos Santos',
    role: 'Engenheiro Físico e Programador',
    description:
      'Lidera a visão tecnológica do Emprego STP, unindo engenharia, produto e programação para construir uma plataforma simples, útil e preparada para crescer.',
    image: '/assets/imagens/edmir.jpeg',
    imagePosition: 'center 22%',
  },
  {
    name: 'Joel Almeida',
    role: 'Gestor',
    featured: true,
    description:
      'Acompanha a organização operacional e a relação com parceiros, ajudando a transformar necessidades reais em processos claros para candidatos e empresas.',
    image: '/assets/imagens/joel.jpeg',
    imagePosition: 'center 22%',
  },
  {
    name: 'Mauro Viegas',
    role: 'Gestor',
    description:
      'Contribui para a gestão estratégica da plataforma, com foco em crescimento, credibilidade e criação de valor para o mercado de trabalho nacional.',
    image: '/assets/imagens/mauro.jpeg',
    imagePosition: 'center 18%',
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
  {
    title: 'Futuro',
    description:
      'Evolução constante, orientada pelo feedback e pelas novas formas de trabalhar no país.',
    Icon: LuGlobe,
    tone: 'slate',
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
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinStatus, setJoinStatus] = useState(null);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [joinForm, setJoinForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const joinTriggerRef = useRef(null);
  const joinDialogRef = useRef(null);
  const joinCloseRef = useRef(null);

  const handleJoinField = (field) => (event) => {
    const { value } = event.target;
    setJoinForm((previous) => ({ ...previous, [field]: value }));
  };

  // Antes abria o cliente de email do visitante com um mailto: para um domínio
  // que não existe, e a candidatura perdia-se. Agora vai pelo servidor, fica
  // registada em `contactMessages` e chega à caixa institucional.
  const handleJoinSubmit = async (event) => {
    event.preventDefault();
    if (submittingJoin) return;

    setJoinStatus(null);

    if (joinForm.name.trim().length < 2) {
      setJoinStatus({ type: 'error', text: 'Indique o seu nome.' });
      return;
    }
    if (joinForm.message.trim().length < 10) {
      setJoinStatus({
        type: 'error',
        text: 'Escreva uma mensagem com pelo menos 10 caracteres.',
      });
      return;
    }

    setSubmittingJoin(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: joinForm.name.trim(),
          email: joinForm.email.trim(),
          subject: 'carreira',
          message: joinForm.message.trim(),
          source: 'carreiras',
        }),
      });
      const resultado = await response.json().catch(() => ({}));

      if (!response.ok) {
        setJoinStatus({
          type: 'error',
          text: resultado.error || 'Não foi possível enviar. Tente novamente.',
        });
        return;
      }

      setJoinStatus({
        type: 'success',
        text:
          resultado.message || 'Candidatura enviada! Entraremos em contacto.',
      });
      setJoinForm({ name: '', email: '', message: '' });
    } catch {
      setJoinStatus({
        type: 'error',
        text: 'Falha de ligação. Verifique a internet e tente novamente.',
      });
    } finally {
      setSubmittingJoin(false);
    }
  };

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

  useEffect(() => {
    if (!joinOpen) return undefined;

    const previousActive = document.activeElement;
    const dialog = joinDialogRef.current;
    const animationFrame = window.requestAnimationFrame(() => {
      joinCloseRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setJoinOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;

      const focusableElements = [
        ...dialog.querySelectorAll('button, input, textarea'),
      ].filter((element) => !element.disabled);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActive instanceof HTMLElement) previousActive.focus();
    };
  }, [joinOpen]);

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
        <div className={styles.page}>
          <div className={styles.pageContent}>
            <section className={styles.hero} aria-labelledby="about-title">
              <div className={styles.heroInner}>
                <p className={styles.eyebrow}>Quem somos</p>
                <h1 id="about-title" className={styles.heroTitle}>
                  Pessoas focadas em aproximar talento e oportunidade
                </h1>
                <p className={styles.heroLead}>
                  Uma equipa pequena e dedicada, a construir a ponte entre quem
                  procura e quem contrata em São Tomé e Príncipe. Nascemos para
                  simplificar, modernizar e impulsionar o mercado de trabalho.
                </p>
              </div>
            </section>

            <section
              className={styles.missionSection}
              aria-labelledby="mission-title"
            >
              <div className={styles.container}>
                <div className={styles.missionLayout}>
                  <div className={styles.missionCopy}>
                    <h2 id="mission-title">Cada vaga, uma árvore</h2>
                    <p>
                      Acreditamos que o progresso deve criar oportunidades e
                      cuidar do futuro. Por cada vaga publicada, assumimos o
                      compromisso de transformar crescimento profissional em
                      impacto positivo para as pessoas, para a comunidade e para
                      o ambiente de São Tomé e Príncipe.
                    </p>
                  </div>
                  <span className={styles.missionIcon} aria-hidden="true">
                    <LuTreePine />
                  </span>
                </div>
              </div>
            </section>

            <section
              className={styles.teamSection}
              aria-labelledby="team-title"
            >
              <div className={styles.container}>
                <header className={styles.sectionHeader}>
                  <h2 id="team-title">A Nossa Equipa</h2>
                  <p>Conheça os rostos por trás da plataforma.</p>
                </header>

                <div className={styles.teamGrid}>
                  {TEAM.map((member) => (
                    <article
                      key={member.name}
                      className={`${styles.teamCard} ${
                        member.featured ? styles.teamCardFeatured : ''
                      }`}
                    >
                      {member.badge ? (
                        <span className={styles.featuredBadge}>
                          {member.badge}
                        </span>
                      ) : null}

                      <div className={styles.avatarFrame}>
                        <Image
                          src={member.image}
                          alt={`Retrato de ${member.name}`}
                          fill
                          sizes="(max-width: 900px) 128px, 128px"
                          className={styles.avatarImage}
                          style={{ objectPosition: member.imagePosition }}
                        />
                      </div>

                      <h3>{member.name}</h3>
                      <span className={styles.roleBadge}>{member.role}</span>
                      <p>{member.description}</p>
                    </article>
                  ))}
                </div>

                <div className={styles.joinCta}>
                  <p>
                    Quer construir connosco o futuro do emprego em São Tomé e
                    Príncipe?
                    <br />
                    Adorávamos conhecer o seu talento.
                  </p>
                  <button
                    type="button"
                    ref={joinTriggerRef}
                    className={styles.joinButton}
                    onClick={() => setJoinOpen(true)}
                  >
                    Junte-se à nossa equipa
                    <FiArrowRight aria-hidden="true" />
                  </button>
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
                >
                  <h2 id="audience-title">Uma plataforma para todos</h2>
                  <p>
                    Construída para ligar pessoas, empresas e conhecimento num
                    mercado de trabalho mais próximo e transparente.
                  </p>
                </header>

                <div className={styles.audienceGrid}>
                  {AUDIENCES.map(({ title, description, Icon, tone }) => (
                    <article key={title} className={styles.audienceCard}>
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
                  ))}
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
                >
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
                  <div className={styles.sharePitch}>
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

      {joinOpen
        ? createPortal(
            <div
              className={styles.modalOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="join-title"
              aria-describedby="join-description"
              onClick={(event) => {
                if (event.target === event.currentTarget) setJoinOpen(false);
              }}
            >
              <div ref={joinDialogRef} className={styles.modal}>
                <button
                  type="button"
                  ref={joinCloseRef}
                  className={styles.modalClose}
                  onClick={() => setJoinOpen(false)}
                  aria-label="Fechar formulário"
                >
                  <FiX aria-hidden="true" />
                </button>

                <p className={styles.modalEyebrow}>Carreiras</p>
                <h2 id="join-title">Junte-se à nossa equipa</h2>
                <p id="join-description" className={styles.modalDescription}>
                  Conte-nos quem é e como gostaria de contribuir para o Emprego
                  STP. A sua candidatura chega diretamente à nossa equipa.
                </p>

                <form className={styles.joinForm} onSubmit={handleJoinSubmit}>
                  <div className={styles.formGrid}>
                    <label className={styles.field} htmlFor="join-name">
                      <span>Nome</span>
                      <input
                        id="join-name"
                        type="text"
                        value={joinForm.name}
                        onChange={handleJoinField('name')}
                        placeholder="O seu nome"
                        maxLength={80}
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className={styles.field} htmlFor="join-email">
                      <span>Email</span>
                      <input
                        id="join-email"
                        type="email"
                        value={joinForm.email}
                        onChange={handleJoinField('email')}
                        placeholder="email@exemplo.com"
                        maxLength={120}
                        autoComplete="email"
                        required
                      />
                    </label>
                  </div>

                  <label className={styles.field} htmlFor="join-message">
                    <span>Mensagem</span>
                    <textarea
                      id="join-message"
                      value={joinForm.message}
                      onChange={handleJoinField('message')}
                      placeholder="Fale-nos sobre si, a sua experiência e como gostaria de contribuir."
                      rows={5}
                      maxLength={1200}
                      required
                    />
                    <small>{joinForm.message.length}/1200</small>
                  </label>

                  {joinStatus ? (
                    <p
                      className={`${styles.formStatus} ${
                        joinStatus.type === 'success'
                          ? styles.formStatusSuccess
                          : styles.formStatusError
                      }`}
                      role="status"
                    >
                      {joinStatus.text}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={submittingJoin}
                  >
                    {submittingJoin ? 'A enviar...' : 'Enviar candidatura'}
                    <FiSend aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
