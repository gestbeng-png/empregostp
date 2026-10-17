import { Fragment, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiHeadphones,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSend,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import useScrollReveal from '../lib/useScrollReveal';
import styles from '../styles/ContactPage.module.css';

const PHOTOS = '/assets/imagens/Fotos para usar no site';
const HERO_PHOTOS = {
  main: `${PHOTOS}/06092026-EmpregoSTP Sequência nº (002)-20.jpg`,
  float: `${PHOTOS}/06092026-EmpregoSTP Sequência nº (002)-6.jpg`,
};

// O nome acessível do h1 tem de continuar a ser «Vamos falar sobre o seu
// próximo passo» (e2e/contact-public.spec.ts).
const HERO_WORDS = [
  'Vamos',
  'falar',
  'sobre',
  'o',
  'seu',
  { text: 'próximo', accent: true },
  { text: 'passo', accent: true },
];

const SUBJECT_OPTIONS = [
  { value: 'candidato', label: 'Sou candidato' },
  { value: 'empresa', label: 'Sou empresa' },
  { value: 'suporte', label: 'Apoio / conta' },
  { value: 'parceria', label: 'Parceria ou imprensa' },
  { value: 'outro', label: 'Outro assunto' },
];

const QUICK_FACTS = [
  {
    icon: FiClock,
    title: 'Tempo de resposta',
    value: 'Até 24h úteis',
  },
  {
    icon: FiMapPin,
    title: 'Equipa local',
    value: 'São Tomé',
  },
];

const DIRECT_CONTACTS = [
  {
    icon: FiMail,
    label: 'Email',
    value: 'contacto@empregostp.com',
    href: 'mailto:contacto@empregostp.com',
  },
  {
    icon: FiPhone,
    label: 'Telefone / WhatsApp',
    value: '+239 986 9673',
    href: 'https://wa.me/2399869673',
    external: true,
  },
  {
    icon: FiHeadphones,
    label: 'Horário de apoio',
    value: 'Segunda a sexta, das 8h às 17h',
  },
];

const INITIAL_FORM = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactoPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const pageRef = useRef(null);
  useScrollReveal(pageRef);

  const isSubmitting = status.state === 'submitting';

  const handleField = (field) => (event) => {
    const { value } = event.target;
    setForm((previous) => ({ ...previous, [field]: value }));

    if (status.state === 'error' || status.state === 'success') {
      setStatus({ state: 'idle', message: '' });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (form.name.trim().length < 2) {
      setStatus({
        state: 'error',
        message: 'Indique o seu nome com pelo menos 2 caracteres.',
      });
      return;
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setStatus({
        state: 'error',
        message: 'Introduza um endereço de email válido.',
      });
      return;
    }

    if (!form.subject) {
      setStatus({ state: 'error', message: 'Selecione um assunto.' });
      return;
    }

    if (form.message.trim().length < 10) {
      setStatus({
        state: 'error',
        message: 'Escreva uma mensagem com pelo menos 10 caracteres.',
      });
      return;
    }

    setStatus({ state: 'submitting', message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'contacto' }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || 'Não foi possível enviar a mensagem. Tente novamente.',
        );
      }

      setStatus({
        state: 'success',
        message: data.message || 'Mensagem enviada com sucesso.',
      });
      setForm(INITIAL_FORM);
    } catch (error) {
      setStatus({
        state: 'error',
        message:
          error.message ||
          'Não foi possível enviar a mensagem. Tente novamente.',
      });
    }
  };

  return (
    <>
      <Head>
        <title>Contacto | EmpregoSTP</title>
        <meta
          name="description"
          content="Fale com a equipa do EmpregoSTP. Tire dúvidas, peça apoio ou proponha uma parceria — respondemos a candidatos e empresas em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell>
        {/* O div interior evita as regras globais do Workbridge que decoram
            `main > div > section:first-of-type` com círculos e tipografia. */}
        <div className={styles.page} ref={pageRef}>
          <div className={styles.flow}>
            <section className={styles.hero} aria-labelledby="contact-title">
              <div className={styles.heroGlow} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={`${styles.container} ${styles.heroLayout}`}>
                <div>
                  <p className={styles.badge}>
                    <span className={styles.pulse} aria-hidden="true" />
                    Fale connosco
                  </p>
                  <h1 id="contact-title" className={styles.title}>
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
                  <p className={styles.lead}>
                    Estamos aqui para ajudar. Preencha o formulário ou utilize
                    os nossos canais de contacto direto.
                  </p>
                  <div className={styles.heroActions}>
                    <a href="#mensagem" className={styles.primary}>
                      Escrever mensagem
                      <FiArrowRight aria-hidden="true" />
                    </a>
                    <a
                      href="https://wa.me/2399869673"
                      className={styles.ghost}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Falar no WhatsApp
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
                    <Image src={HERO_PHOTOS.float} alt="" fill sizes="12rem" />
                  </div>
                  <div className={styles.heroChip}>
                    <span className={styles.chipIcon}>
                      <FiClock />
                    </span>
                    <span>
                      <strong>Resposta em até 24h úteis</strong>
                      <small>Equipa local em São Tomé</small>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div id="mensagem" className={`${styles.container} ${styles.body}`}>
              <div className={styles.layout}>
                <section
                  className={styles.formCard}
                  aria-labelledby="contact-form-title"
                  data-reveal
                >
                  <p className={styles.kicker}>Formulário</p>
                  <h2 id="contact-form-title" className={styles.sectionTitle}>
                    Envie-nos uma <span>mensagem</span>
                  </h2>

                  <form
                    className={styles.form}
                    onSubmit={handleSubmit}
                    noValidate
                  >
                    <div className={styles.formRow}>
                      <div className={styles.field}>
                        <label htmlFor="contact-name">Nome</label>
                        <input
                          id="contact-name"
                          type="text"
                          value={form.name}
                          onChange={handleField('name')}
                          placeholder="O seu nome"
                          autoComplete="name"
                          maxLength={80}
                          required
                        />
                      </div>

                      <div className={styles.field}>
                        <label htmlFor="contact-email">Email</label>
                        <input
                          id="contact-email"
                          type="email"
                          value={form.email}
                          onChange={handleField('email')}
                          placeholder="O seu email"
                          autoComplete="email"
                          maxLength={160}
                          required
                        />
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.field}>
                        <label htmlFor="contact-phone">
                          Telefone (opcional)
                        </label>
                        <input
                          id="contact-phone"
                          type="tel"
                          value={form.phone}
                          onChange={handleField('phone')}
                          placeholder="O seu número"
                          autoComplete="tel"
                          maxLength={40}
                        />
                      </div>

                      <div className={styles.field}>
                        <label htmlFor="contact-subject">Assunto</label>
                        <select
                          id="contact-subject"
                          className={styles.select}
                          value={form.subject}
                          onChange={handleField('subject')}
                          required
                        >
                          <option value="" disabled>
                            Selecione um assunto
                          </option>
                          {SUBJECT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="contact-message">Mensagem</label>
                      <textarea
                        id="contact-message"
                        value={form.message}
                        onChange={handleField('message')}
                        placeholder="Como podemos ajudar?"
                        rows={7}
                        maxLength={4000}
                        required
                      />
                    </div>

                    {status.state === 'success' ? (
                      <p className={styles.successNote} role="status">
                        <FiCheckCircle aria-hidden="true" />
                        {status.message}
                      </p>
                    ) : null}

                    {status.state === 'error' ? (
                      <p className={styles.errorNote} role="alert">
                        <FiAlertCircle aria-hidden="true" />
                        {status.message}
                      </p>
                    ) : null}

                    <div className={styles.formActions}>
                      <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                      >
                        <span>
                          {isSubmitting ? 'A enviar...' : 'Enviar mensagem'}
                        </span>
                        <FiSend aria-hidden="true" />
                      </button>

                      <p className={styles.privacyNote}>
                        Ao enviar, concorda com a nossa{' '}
                        <Link href="/politica-privacidade">
                          política de privacidade
                        </Link>
                        .
                      </p>
                    </div>
                  </form>
                </section>

                <aside
                  className={styles.infoColumn}
                  aria-label="Informações de contacto"
                >
                  <div className={styles.quickFacts} data-reveal>
                    {QUICK_FACTS.map((fact) => {
                      const Icon = fact.icon;

                      return (
                        <article
                          key={fact.title}
                          className={styles.quickFactCard}
                        >
                          <span
                            className={styles.quickFactIcon}
                            aria-hidden="true"
                          >
                            <Icon />
                          </span>
                          <h2>{fact.title}</h2>
                          <p>{fact.value}</p>
                        </article>
                      );
                    })}
                  </div>

                  <section
                    className={styles.directCard}
                    aria-labelledby="direct-contacts-title"
                    data-reveal
                    style={{ '--delay': '120ms' }}
                  >
                    <h2 id="direct-contacts-title">Contactos diretos</h2>
                    <ul className={styles.directList}>
                      {DIRECT_CONTACTS.map((contact) => {
                        const Icon = contact.icon;
                        const copy = (
                          <>
                            <span className={styles.directLabel}>
                              {contact.label}
                            </span>
                            <span className={styles.directValue}>
                              {contact.value}
                            </span>
                          </>
                        );

                        return (
                          <li key={contact.label} className={styles.directItem}>
                            <span
                              className={styles.directIcon}
                              aria-hidden="true"
                            >
                              <Icon />
                            </span>
                            {contact.href ? (
                              <a
                                href={contact.href}
                                className={styles.directCopy}
                                {...(contact.external
                                  ? { target: '_blank', rel: 'noreferrer' }
                                  : {})}
                              >
                                {copy}
                              </a>
                            ) : (
                              <span className={styles.directCopy}>{copy}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  <figure
                    className={styles.teamVisual}
                    data-reveal
                    style={{ '--delay': '200ms' }}
                  >
                    <Image
                      src="/assets/people/team-working.webp"
                      alt="Dois profissionais a trabalhar em conjunto"
                      fill
                      sizes="(max-width: 1050px) 50vw, 40vw"
                      className={styles.teamImage}
                    />
                    <span className={styles.imageShade} aria-hidden="true" />
                    <figcaption>
                      Dedicados ao seu sucesso em São Tomé e Príncipe
                    </figcaption>
                  </figure>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}
