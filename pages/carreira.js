import { Fragment, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import {
  FiArrowRight,
  FiAward,
  FiBookOpen,
  FiCompass,
  FiZap,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import CareerApplication from '../components/careers/CareerApplication';
import CareerOpportunities from '../components/careers/CareerOpportunities';
import CareerTeam from '../components/careers/CareerTeam';
import {
  HERO_PHOTOS,
  MARQUEE,
  STEPS,
  VALUES,
} from '../components/careers/content';
import useScrollReveal from '../hooks/useScrollReveal';
import styles from '../styles/CarreiraPage.module.css';

const title = 'Carreiras no Empregos STP | Trabalhe Connosco';
const description =
  'Conheça a equipa, a cultura e as oportunidades de carreira no Empregos STP. Descubra como pode contribuir para o futuro do trabalho em São Tomé e Príncipe.';

const HERO_WORDS = [
  'Construa',
  'connosco',
  'o',
  { text: 'futuro', accent: true },
  'do',
  'trabalho',
  'em',
  'São',
  'Tomé',
  'e',
  'Príncipe.',
];

const VALUE_ICONS = {
  compass: FiCompass,
  award: FiAward,
  book: FiBookOpen,
  zap: FiZap,
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function moveTo(target) {
  target?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    block: 'start',
  });
}

// Luz que segue o cursor dentro dos cartões de valores.
function trackSpotlight(event) {
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
  card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
}

export default function CarreiraPage() {
  const [open, setOpen] = useState(false);
  const pageRef = useRef(null);
  const formRef = useRef(null);
  useScrollReveal(pageRef);

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  }

  function openApplication(event) {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    setOpen(true);
    window.history.replaceState(null, '', '#candidatura');
    requestAnimationFrame(() => {
      moveTo(formRef.current);
      formRef.current?.querySelector('input')?.focus({ preventScroll: true });
    });
  }

  function explore(event) {
    if (isModifiedClick(event)) return;
    const target = document.getElementById('oportunidades');
    if (!target) return;
    event.preventDefault();
    window.history.replaceState(null, '', '#oportunidades');
    moveTo(target);
    target.focus({ preventScroll: true });
  }

  const isPreview =
    process.env.NODE_ENV !== 'production' ||
    (process.env.NEXT_PUBLIC_VERCEL_ENV &&
      process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production');

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://empregostp.com/carreira" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content="https://empregostp.com/carreira" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {isPreview ? <meta name="robots" content="noindex, nofollow" /> : null}
      </Head>
      <PublicPageShell>
        {/* O div interior evita as regras globais do Workbridge que decoram
            `main > div > section:first-of-type` com círculos e tipografia. */}
        <div className={styles.page} ref={pageRef}>
          <div className={styles.flow}>
            <section
              className={styles.careerHero}
              aria-labelledby="career-title"
            >
              <div className={styles.heroGlow} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={`${styles.container} ${styles.heroLayout}`}>
                <div className={styles.heroCopyBlock}>
                  <p className={styles.badge}>
                    <span className={styles.pulse} aria-hidden="true" />
                    Carreiras no Empregos STP
                  </p>
                  <h1 id="career-title" className={styles.heroHeading}>
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
                    Procuramos pessoas com ideias e vontade de fazer acontecer.
                  </p>
                  <div className={styles.heroActions}>
                    <a
                      className={styles.primary}
                      href="#oportunidades"
                      onClick={explore}
                    >
                      Ver oportunidades
                      <FiArrowRight aria-hidden="true" />
                    </a>
                    <a
                      className={styles.ghost}
                      href="#candidatura"
                      onClick={openApplication}
                    >
                      Candidatura espontânea
                    </a>
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
                    <Image
                      src={HERO_PHOTOS.standing}
                      alt=""
                      fill
                      sizes="12rem"
                    />
                  </div>
                  <div className={styles.heroChip}>
                    <span className={styles.chipAvatar}>
                      <Image src={HERO_PHOTOS.smile} alt="" fill sizes="3rem" />
                    </span>
                    <span>
                      <strong>Candidaturas abertas</strong>
                      <small>Todo o ano</small>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div className={styles.marquee} aria-hidden="true">
              <div className={styles.marqueeTrack}>
                {[...MARQUEE, ...MARQUEE].map((item, index) => (
                  <span key={`${item}-${index}`}>
                    {item}
                    <i />
                  </span>
                ))}
              </div>
            </div>

            <section className={styles.section} aria-labelledby="values-title">
              <div className={styles.container}>
                <header className={styles.sectionHead} data-reveal>
                  <p className={styles.kicker}>Como trabalhamos</p>
                  <h2 id="values-title" className={styles.sectionHeading}>
                    Pensamos em grande. <span>Fazemos com método.</span>
                  </h2>
                </header>
                <div className={styles.valuesGrid}>
                  {VALUES.map((value, index) => {
                    const Icon = VALUE_ICONS[value.icon];
                    // O wrapper revela-se; o cartão fica livre para as
                    // transições do hover.
                    return (
                      <div
                        key={value.title}
                        data-reveal
                        style={{ '--delay': `${index * 90}ms` }}
                      >
                        <article
                          className={styles.valueCard}
                          onMouseMove={trackSpotlight}
                        >
                          <span className={styles.valueIcon} aria-hidden="true">
                            <Icon />
                          </span>
                          <h3>{value.title}</h3>
                          <p>{value.text}</p>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              className={`${styles.section} ${styles.sectionSoft}`}
              aria-labelledby="team-title"
            >
              <div className={styles.container}>
                <header
                  className={`${styles.sectionHead} ${styles.sectionHeadCenter}`}
                  data-reveal
                >
                  <p className={styles.kicker}>A equipa</p>
                  <h2 id="team-title" className={styles.sectionHeading}>
                    Venha desenvolver <span>o ecossistema de trabalho</span>{' '}
                    connosco.
                  </h2>
                </header>
                <CareerTeam />
              </div>
            </section>

            <section
              id="oportunidades"
              tabIndex={-1}
              className={styles.section}
              aria-labelledby="roles-title"
            >
              <div className={`${styles.container} ${styles.rolesLayout}`}>
                <div data-reveal>
                  <p className={styles.kicker}>Trabalhe connosco</p>
                  <h2 id="roles-title" className={styles.sectionHeading}>
                    Vagas na equipa
                  </h2>
                  <CareerOpportunities />
                </div>
                <aside
                  className={styles.spontaneous}
                  data-reveal
                  style={{ '--delay': '120ms' }}
                >
                  <h3>Não encontrou a sua vaga?</h3>
                  <p>Mostre-nos o que sabe fazer.</p>
                  <a
                    href="#candidatura"
                    className={styles.primary}
                    aria-expanded={open}
                    aria-controls="career-application-form"
                    onClick={openApplication}
                  >
                    Candidatura espontânea
                    <FiArrowRight aria-hidden="true" />
                  </a>
                </aside>
              </div>
              <div className={styles.container}>
                <div id="candidatura" ref={formRef} className={styles.anchor}>
                  <CareerApplication open={open} setOpen={setOpen} />
                </div>
              </div>
            </section>

            <section
              className={`${styles.section} ${styles.sectionDark}`}
              aria-labelledby="process-title"
            >
              <div className={styles.container}>
                <header className={styles.sectionHead} data-reveal>
                  <p className={styles.kicker}>O processo</p>
                  <h2 id="process-title" className={styles.sectionHeading}>
                    Simples e transparente.
                  </h2>
                </header>
                <ol className={styles.steps} data-reveal>
                  {STEPS.map((step, index) => (
                    <li
                      key={step.title}
                      className={styles.step}
                      style={{ '--delay': `${200 + index * 160}ms` }}
                    >
                      <span className={styles.stepNumber} aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}
