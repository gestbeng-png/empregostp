import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBriefcase,
  FiChevronLeft,
  FiChevronRight,
  FiFeather,
  FiSend,
  FiStar,
  FiTrendingUp,
  FiUser,
  FiX,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import styles from '../styles/SobreNosPage.module.css';

const TEAM = [
  {
    name: 'Edmir dos Santos',
    role: 'Engenheiro Físico e Programador',
    description:
      'Lidera a visão tecnológica do Emprego STP, unindo engenharia, produto e programação para construir uma plataforma simples, útil e preparada para crescer.',
    image: '/assets/imagens/edmir.jpeg',
    imagePosition: 'center center',
  },
  {
    name: 'Joel Almeida',
    role: 'Gestor',
    description:
      'Acompanha a organização operacional e a relação com parceiros, ajudando a transformar necessidades reais em processos claros para candidatos e empresas.',
    image: '/assets/imagens/joel.jpeg',
    imagePosition: 'center center',
  },
  {
    name: 'Mauro Viegas',
    role: 'Gestor',
    description:
      'Contribui para a gestão estratégica da plataforma, com foco em crescimento, credibilidade e criação de valor para o mercado de trabalho nacional.',
    image: '/assets/imagens/mauro.jpeg',
    imagePosition: 'center top',
  },
];

const COMMUNITY = [
  {
    title: 'Candidatos',
    description: 'Perfis, candidaturas e crescimento profissional.',
    Icon: FiUser,
  },
  {
    title: 'Empresas',
    description: 'Vagas, triagem e recrutamento com confiança.',
    Icon: FiBriefcase,
  },
  {
    title: 'Comunidade',
    description: 'Respeito, entreajuda e oportunidades para todos.',
    Icon: FiFeather,
  },
  {
    title: 'Futuro',
    description: 'Cada vaga, uma árvore e um compromisso com o país.',
    Icon: FiTrendingUp,
  },
];

// Testemunhos base — garantem que o carrossel nunca fica vazio.
// Testemunhos aprovados na moderação são acrescentados a estes.
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
    role: 'Gestor de RH',
    rating: 5,
    message:
      'Conseguimos preencher duas vagas técnicas com candidatos locais qualificados. Tornou-se uma ferramenta essencial para a nossa empresa.',
  },
  {
    id: 'seed-3',
    name: 'Márcia Pires',
    role: 'Candidata',
    rating: 4,
    message:
      'Gosto da missão "cada vaga, uma árvore". Sinto que estou a contribuir para algo maior do que apenas um emprego.',
  },
];

function Stars({ value = 0 }) {
  return (
    <span className={styles.stars} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <FiStar
          key={n}
          className={n <= value ? styles.starOn : styles.starOff}
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
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Estado do formulário
  const [form, setForm] = useState({ name: '', role: '', rating: 0, message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // { type, text }

  // "Junte-se à nossa equipa" — formulário que envia por email
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinForm, setJoinForm] = useState({ name: '', email: '', message: '' });

  const handleJoinField = (field) => (event) => {
    const { value } = event.target;
    setJoinForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleJoinSubmit = (event) => {
    event.preventDefault();
    const subject = `Junte-se à equipa — ${joinForm.name.trim() || 'Candidatura'}`;
    const body = [
      `Nome: ${joinForm.name.trim()}`,
      `Email: ${joinForm.email.trim()}`,
      '',
      'Mensagem:',
      joinForm.message.trim(),
    ].join('\n');
    const mailto = `mailto:suporte@empregostp.st?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setJoinOpen(false);
  };

  // Fecha o modal com a tecla Escape e bloqueia o scroll do fundo
  useEffect(() => {
    if (!joinOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setJoinOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [joinOpen]);

  const trackRef = useRef(null);

  // Carrega testemunhos aprovados e junta aos base
  useEffect(() => {
    let cancelled = false;
    fetch('/api/testimonials')
      .then((res) => (res.ok ? res.json() : { testimonials: [] }))
      .then((data) => {
        if (cancelled) return;
        const approved = Array.isArray(data.testimonials) ? data.testimonials : [];
        if (approved.length) {
          setTestimonials([...approved, ...SEED_TESTIMONIALS]);
        }
      })
      .catch(() => {
        /* mantém os testemunhos base */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const count = testimonials.length;

  const goTo = useCallback(
    (index) => {
      setActive((prev) => {
        if (count === 0) return 0;
        return ((index % count) + count) % count;
      });
    },
    [count],
  );

  const next = useCallback(() => goTo(active + 1), [goTo, active]);
  const prev = useCallback(() => goTo(active - 1), [goTo, active]);

  // Autoplay
  useEffect(() => {
    if (paused || count <= 1) return undefined;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % count);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, count]);

  // Mantém o índice válido se a lista mudar
  useEffect(() => {
    setActive((prev) => (prev >= count ? 0 : prev));
  }, [count]);

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitStatus(null);

    if (form.name.trim().length < 2) {
      setSubmitStatus({ type: 'error', text: 'Indique o seu nome (mínimo 2 caracteres).' });
      return;
    }
    if (form.message.trim().length < 12) {
      setSubmitStatus({
        type: 'error',
        text: 'O testemunho deve ter pelo menos 12 caracteres.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role.trim(),
          rating: form.rating || undefined,
          message: form.message.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível enviar o testemunho.');
      }
      setSubmitStatus({
        type: 'success',
        text: data.message || 'Obrigado! O seu testemunho será publicado após revisão.',
      });
      setForm({ name: '', role: '', rating: 0, message: '' });
    } catch (error) {
      setSubmitStatus({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sobre o Emprego STP</title>
        <meta
          name="description"
          content="Conheça a missão, visão e valores que guiam o Emprego STP."
        />
      </Head>

      <PublicPageShell>
        <main className={styles.page}>
          {/* INTRO / QUEM SOMOS */}
          <section className={styles.introSection} aria-labelledby="intro-title">
            <div className={styles.container}>
              <p className={styles.eyebrowCenter}>Quem somos</p>
              <h2 id="intro-title" className={styles.introTitle}>
                Nascemos para aproximar talento e oportunidade
              </h2>
              <p className={styles.introLead}>
                O Emprego STP é uma plataforma são-tomense de emprego, criada
                para aproximar quem procura trabalho de quem procura talento.
                Reunimos vagas de empresas locais num só lugar e damos às
                pessoas as ferramentas para construírem o seu perfil,
                candidatarem-se e crescerem profissionalmente.
              </p>
              <p className={styles.introText}>
                O que nos motiva é a certeza de que o acesso a boas oportunidades
                transforma vidas. Em São Tomé e Príncipe, muito talento fica
                invisível por falta de pontes entre pessoas e empresas — e
                trabalhamos todos os dias para mudar isso, com tecnologia
                acessível, proximidade e um compromisso genuíno com o futuro do
                país e da sua gente.
              </p>
            </div>
          </section>

          {/* MISSION / MOTTO */}
          <section className={styles.missionSection}>
            <div className={styles.container}>
              <div className={styles.missionCard}>
                <FiFeather className={styles.missionWatermark} aria-hidden="true" />
                <p className={styles.missionEyebrow}>O nosso lema</p>
                <h2 className={styles.missionQuote}>
                  &ldquo;Cada vaga, uma árvore.&rdquo;
                </h2>
                <p className={styles.missionText}>
                  Acreditamos que progresso não é só ganhar mais. É cuidar melhor.
                  Por isso, a cada vaga publicada, assumimos um compromisso com o
                  futuro: transformar oportunidades em impacto real — para as
                  pessoas e para o ambiente.
                </p>
              </div>
            </div>
          </section>

          {/* TEAM */}
          <section className={styles.teamSection} aria-labelledby="team-title">
            <div className={styles.container}>
              <div className={styles.sectionHead}>
                <p className={styles.eyebrowCenter}>A nossa equipa</p>
                <h2 id="team-title" className={styles.sectionTitle}>
                  Pessoas focadas em aproximar talento e oportunidade
                </h2>
                <p className={styles.sectionSub}>
                  Uma equipa pequena e dedicada, a construir a ponte entre quem
                  procura e quem contrata.
                </p>
              </div>

              <div className={styles.teamGrid}>
                {TEAM.map((member) => (
                  <article key={member.name} className={styles.teamCard}>
                    <div className={styles.teamAvatar}>
                      <Image
                        src={member.image}
                        alt={member.name}
                        fill
                        sizes="(max-width: 900px) 160px, 192px"
                        style={{ objectPosition: member.imagePosition }}
                      />
                    </div>
                    <div className={styles.teamBody}>
                      <h3>{member.name}</h3>
                      <span className={styles.teamRole}>{member.role}</span>
                      <p>{member.description}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.joinCta}>
                <p>
                  Quer construir connosco o futuro do emprego em São Tomé e
                  Príncipe? Adorávamos conhecer o seu talento.
                </p>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={() => setJoinOpen(true)}
                >
                  Junte-se à nossa equipa
                  <FiArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          {/* COMMUNITY */}
          <section className={styles.communitySection} aria-labelledby="community-title">
            <div className={styles.container}>
              <div className={styles.sectionHead}>
                <p className={styles.eyebrowCenter}>A nossa comunidade</p>
                <h2 id="community-title" className={styles.sectionTitle}>
                  Para quem construímos
                </h2>
                <p className={styles.sectionSub}>
                  Queremos aproximar quem precisa de trabalhar de quem precisa de
                  contratar, com tecnologia simples e uma comunidade que se ajuda.
                </p>
              </div>

              <div className={styles.communityGrid}>
                {COMMUNITY.map(({ title, description, Icon }) => (
                  <article key={title} className={styles.communityCard}>
                    <span className={styles.communityIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>

              <div className={styles.communityCta}>
                <div className={styles.communityCtaCopy}>
                  <h3>Faça parte do movimento</h3>
                  <p>
                    Crie o seu perfil ou publique a sua primeira vaga hoje mesmo.
                  </p>
                </div>
                <div className={styles.communityCtaActions}>
                  <Link href="/register" className={`${styles.button} ${styles.buttonPrimary}`}>
                    Criar conta
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                  <Link href="/vagas" className={`${styles.button} ${styles.buttonSoft}`}>
                    Explorar vagas
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* TESTIMONIALS CAROUSEL */}
          <section id="testemunhos" className={styles.testimonialsSection} aria-labelledby="testimonials-title">
            <div className={styles.container}>
              <div className={styles.sectionHead}>
                <p className={styles.eyebrowCenter}>Testemunhos</p>
                <h2 id="testimonials-title" className={styles.sectionTitle}>
                  Histórias de quem já usou o Emprego STP
                </h2>
                <p className={styles.sectionSub}>
                  Candidatos e empresas que encontraram oportunidades e resultados
                  reais na nossa plataforma.
                </p>
              </div>

              {count > 0 && (
                <div
                  className={styles.carousel}
                  onMouseEnter={() => setPaused(true)}
                  onMouseLeave={() => setPaused(false)}
                  onFocusCapture={() => setPaused(true)}
                  onBlurCapture={() => setPaused(false)}
                >
                  <div className={styles.carouselViewport}>
                    <div
                      ref={trackRef}
                      className={styles.carouselTrack}
                      style={{ transform: `translateX(-${active * 100}%)` }}
                    >
                      {testimonials.map((item) => (
                        <div className={styles.carouselSlide} key={item.id}>
                          <article className={styles.testimonialCard}>
                            <span className={styles.quoteMark} aria-hidden="true">
                              &ldquo;
                            </span>
                            {item.rating ? <Stars value={item.rating} /> : null}
                            <p className={styles.testimonialMessage}>{item.message}</p>
                            <div className={styles.testimonialAuthor}>
                              <span className={styles.testimonialAvatar} aria-hidden="true">
                                {initialsOf(item.name)}
                              </span>
                              <span className={styles.testimonialMeta}>
                                <strong>{item.name}</strong>
                                {item.role ? <span>{item.role}</span> : null}
                              </span>
                            </div>
                          </article>
                        </div>
                      ))}
                    </div>
                  </div>

                  {count > 1 && (
                    <div className={styles.carouselControls}>
                      <button
                        type="button"
                        className={styles.carouselArrow}
                        onClick={prev}
                        aria-label="Testemunho anterior"
                      >
                        <FiChevronLeft aria-hidden="true" />
                      </button>
                      <div className={styles.carouselDots} aria-label="Selecionar testemunho">
                        {testimonials.map((item, index) => (
                          <button
                            type="button"
                            key={item.id}
                            className={`${styles.dot} ${index === active ? styles.dotActive : ''}`}
                            aria-label={`Ir para o testemunho ${index + 1}`}
                            aria-current={index === active ? 'true' : undefined}
                            onClick={() => goTo(index)}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.carouselArrow}
                        onClick={next}
                        aria-label="Testemunho seguinte"
                      >
                        <FiChevronRight aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* SHARE A TESTIMONIAL */}
          <section className={styles.shareSection} aria-labelledby="share-title">
            <div className={styles.container}>
              <div className={styles.shareCard}>
                <div className={styles.shareIntro}>
                  <p className={styles.eyebrowCenter}>Partilhe a sua experiência</p>
                  <h2 id="share-title" className={styles.shareTitle}>
                    Deixe o seu testemunho
                  </h2>
                  <p className={styles.shareText}>
                    A sua história inspira outras pessoas. Conte-nos como o Emprego
                    STP fez a diferença para si. Cada testemunho é revisto pela
                    nossa equipa antes de ser publicado.
                  </p>
                </div>

                <form className={styles.shareForm} onSubmit={handleSubmit}>
                  <div className={styles.formRow}>
                    <div className={styles.formField}>
                      <label htmlFor="testimonial-name">Nome *</label>
                      <input
                        id="testimonial-name"
                        type="text"
                        value={form.name}
                        onChange={handleFieldChange('name')}
                        placeholder="O seu nome"
                        maxLength={60}
                        required
                      />
                    </div>
                    <div className={styles.formField}>
                      <label htmlFor="testimonial-role">Cargo / função (opcional)</label>
                      <input
                        id="testimonial-role"
                        type="text"
                        value={form.role}
                        onChange={handleFieldChange('role')}
                        placeholder="Ex.: Candidata · São Tomé"
                        maxLength={80}
                      />
                    </div>
                  </div>

                  <div className={styles.formField}>
                    <span className={styles.formLabel}>Avaliação (opcional)</span>
                    <div className={styles.ratingPicker} role="radiogroup" aria-label="Avaliação">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          type="button"
                          key={n}
                          className={`${styles.ratingStar} ${
                            n <= form.rating ? styles.ratingStarOn : ''
                          }`}
                          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                          aria-pressed={n <= form.rating}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              rating: prev.rating === n ? 0 : n,
                            }))
                          }
                        >
                          <FiStar aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.formField}>
                    <label htmlFor="testimonial-message">O seu testemunho *</label>
                    <textarea
                      id="testimonial-message"
                      value={form.message}
                      onChange={handleFieldChange('message')}
                      placeholder="Conte-nos a sua experiência com o Emprego STP..."
                      rows={4}
                      maxLength={600}
                      required
                    />
                    <span className={styles.charCount}>{form.message.length}/600</span>
                  </div>

                  {submitStatus ? (
                    <p
                      className={`${styles.formNote} ${
                        submitStatus.type === 'success'
                          ? styles.formNoteSuccess
                          : styles.formNoteError
                      }`}
                      role="status"
                    >
                      {submitStatus.text}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className={`${styles.button} ${styles.buttonPrimary} ${styles.shareSubmit}`}
                    disabled={submitting}
                  >
                    {submitting ? 'A enviar...' : 'Enviar testemunho'}
                    {!submitting && <FiSend aria-hidden="true" />}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>

        {joinOpen ? (
          <div
            className={styles.joinOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) setJoinOpen(false);
            }}
          >
            <div className={styles.joinModal}>
              <button
                type="button"
                className={styles.joinClose}
                onClick={() => setJoinOpen(false)}
                aria-label="Fechar"
              >
                <FiX aria-hidden="true" />
              </button>

              <p className={styles.eyebrowCenter}>Carreiras</p>
              <h2 id="join-title" className={styles.joinTitle}>
                Junte-se à nossa equipa
              </h2>
              <p className={styles.joinSub}>
                Conte-nos quem é e porque quer fazer parte do Emprego STP. Ao
                enviar, abrimos o seu email já preenchido para a nossa equipa.
              </p>

              <form className={styles.shareForm} onSubmit={handleJoinSubmit}>
                <div className={styles.formRow}>
                  <div className={styles.formField}>
                    <label htmlFor="join-name">Nome *</label>
                    <input
                      id="join-name"
                      type="text"
                      value={joinForm.name}
                      onChange={handleJoinField('name')}
                      placeholder="O seu nome"
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className={styles.formField}>
                    <label htmlFor="join-email">Email *</label>
                    <input
                      id="join-email"
                      type="email"
                      value={joinForm.email}
                      onChange={handleJoinField('email')}
                      placeholder="email@exemplo.com"
                      maxLength={120}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label htmlFor="join-message">Mensagem *</label>
                  <textarea
                    id="join-message"
                    value={joinForm.message}
                    onChange={handleJoinField('message')}
                    placeholder="Fale-nos sobre si, a sua experiência e como gostaria de contribuir..."
                    rows={5}
                    maxLength={1200}
                    required
                  />
                  <span className={styles.charCount}>
                    {joinForm.message.length}/1200
                  </span>
                </div>

                <button
                  type="submit"
                  className={`${styles.button} ${styles.buttonPrimary} ${styles.shareSubmit}`}
                >
                  Enviar por email
                  <FiSend aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </PublicPageShell>
    </>
  );
}
