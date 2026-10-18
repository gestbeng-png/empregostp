import { Fragment, useRef } from 'react';
import Head from 'next/head';
import {
  FiArrowRight,
  FiCalendar,
  FiEdit3,
  FiMail,
  FiShield,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import useScrollReveal from '../hooks/useScrollReveal';
// O hero, a faixa, as secções e os botões vêm de /carreira para as duas
// páginas manterem o mesmo desenho; o módulo próprio só tem o que é da
// política (índice, cartões numerados, painel do hero).
import career from '../styles/CarreiraPage.module.css';
import styles from '../styles/PrivacyPage.module.css';

const UPDATED_AT = '2 de fevereiro de 2026';

// O nome acessível do h1 tem de continuar a ser «A sua privacidade é uma
// prioridade» (e2e/legal-pages.spec.ts).
const HERO_WORDS = [
  'A',
  'sua',
  { text: 'privacidade', accent: true },
  'é',
  'uma',
  'prioridade',
];

// Duas cópias têm de cobrir a largura do ecrã: a faixa desloca-se 50%.
const MARQUEE = [
  'Transparência',
  'Segurança',
  'Controlo dos seus dados',
  'Sem venda de dados',
  'Direito a corrigir',
  'Direito a remover a conta',
];

const HIGHLIGHTS = [
  { icon: FiShield, text: 'Não vendemos dados pessoais' },
  { icon: FiEdit3, text: 'Pode corrigir ou remover os seus dados' },
  { icon: FiCalendar, text: `Última atualização: ${UPDATED_AT}` },
];

const SECTIONS = [
  {
    id: 'dados-recolhidos',
    title: 'Dados que recolhemos',
    items: [
      'Dados de conta: nome, email, telefone e tipo de perfil.',
      'Dados profissionais: currículo, experiência, competências e preferências.',
      'Dados de navegação: páginas visitadas e interações com vagas.',
    ],
  },
  {
    id: 'utilizacao',
    title: 'Como utilizamos os dados',
    items: [
      'Para aproximar candidatos de vagas relevantes e empresas.',
      'Para melhorar a experiência da plataforma e os serviços disponibilizados.',
      'Para enviar comunicações essenciais sobre candidaturas e atualizações.',
    ],
  },
  {
    id: 'partilha',
    title: 'Partilha de informações',
    text: 'Partilhamos apenas o necessário para permitir a ligação entre candidatos e empresas. Não vendemos dados pessoais a terceiros.',
  },
  {
    id: 'cookies',
    title: 'Cookies e tecnologia',
    text: 'Utilizamos cookies para manter sessões ativas, melhorar a navegação e compreender o uso da plataforma. Pode ajustar as permissões no seu navegador.',
  },
  {
    id: 'seguranca',
    title: 'Segurança',
    text: 'Adotamos práticas de segurança para proteger os seus dados. Apesar disso, nenhum sistema é 100% imune. Recomendamos manter as credenciais em segurança.',
  },
  {
    id: 'direitos',
    title: 'Direitos do utilizador',
    items: [
      'Aceder, atualizar ou corrigir informações pessoais.',
      'Solicitar a remoção da conta e dos dados associados.',
      'Esclarecer dúvidas sobre o tratamento de dados.',
    ],
  },
];

export default function PoliticaPrivacidade() {
  const pageRef = useRef(null);
  useScrollReveal(pageRef);

  return (
    <>
      <Head>
        <title>Política de privacidade | EmpregoSTP</title>
        <meta
          name="description"
          content="Política de Privacidade do Emprego STP."
        />
      </Head>

      <PublicPageShell>
        {/* O div interior evita as regras globais do Workbridge que decoram
            `main > div > section:first-of-type` com círculos e tipografia. */}
        <div className={career.page} ref={pageRef}>
          <div className={styles.flow}>
            <section
              className={career.careerHero}
              aria-labelledby="privacy-title"
            >
              <div className={career.heroGlow} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={`${career.container} ${career.heroLayout}`}>
                <div>
                  <p className={`${career.badge} ${styles.badge}`}>
                    <span className={career.pulse} aria-hidden="true" />
                    Política de Privacidade
                  </p>
                  <h1 id="privacy-title" className={career.heroHeading}>
                    {HERO_WORDS.map((word, index) => {
                      const text = typeof word === 'string' ? word : word.text;
                      return (
                        <Fragment key={text}>
                          <span
                            className={`${career.word} ${
                              word.accent ? career.wordAccent : ''
                            }`}
                            style={{ '--i': index }}
                          >
                            {text}
                          </span>{' '}
                        </Fragment>
                      );
                    })}
                  </h1>
                  <p className={`${career.heroLead} ${styles.heroLead}`}>
                    Esta política explica como o Emprego STP recolhe, utiliza e
                    protege os seus dados pessoais. Ao utilizar a plataforma, o
                    utilizador aceita os termos descritos abaixo.
                  </p>
                  <div className={career.heroActions}>
                    <a className={career.primary} href="#dados-recolhidos">
                      Ler a política
                      <FiArrowRight aria-hidden="true" />
                    </a>
                    <a className={career.ghost} href="#contacto">
                      Tirar uma dúvida
                    </a>
                  </div>
                </div>

                <ul className={styles.highlights}>
                  {HIGHLIGHTS.map(({ icon: Icon, text }, index) => (
                    <li key={text} style={{ '--i': index }}>
                      <span className={styles.highlightIcon} aria-hidden="true">
                        <Icon />
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <div className={career.marquee} aria-hidden="true">
              <div className={career.marqueeTrack}>
                {[...MARQUEE, ...MARQUEE].map((item, index) => (
                  <span key={`${item}-${index}`}>
                    {item}
                    <i />
                  </span>
                ))}
              </div>
            </div>

            <section
              className={career.section}
              aria-labelledby="privacy-content-title"
            >
              <div className={`${career.container} ${styles.layout}`}>
                <nav
                  className={styles.toc}
                  aria-labelledby="privacy-content-title"
                  data-reveal
                >
                  <p className={`${career.kicker} ${styles.kicker}`}>
                    Nesta página
                  </p>
                  <h2 id="privacy-content-title" className={styles.tocTitle}>
                    O essencial, <span>em seis pontos.</span>
                  </h2>
                  <ol className={styles.tocList}>
                    {SECTIONS.map((section, index) => (
                      <li key={section.id}>
                        <a href={`#${section.id}`}>
                          <span aria-hidden="true">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>

                <div className={styles.articles}>
                  {SECTIONS.map((section, index) => (
                    <article
                      key={section.id}
                      id={section.id}
                      className={styles.article}
                      aria-labelledby={`${section.id}-title`}
                      data-reveal
                    >
                      <span className={styles.articleNumber} aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className={styles.articleBody}>
                        <h2 id={`${section.id}-title`}>{section.title}</h2>
                        {section.items ? (
                          <ul>
                            {section.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>{section.text}</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section
              id="contacto"
              className={`${career.section} ${career.sectionDark}`}
              aria-labelledby="privacy-contact-title"
            >
              <div className={`${career.container} ${styles.contactLayout}`}>
                <header data-reveal>
                  <p className={`${career.kicker} ${styles.kicker}`}>
                    Fale connosco
                  </p>
                  <h2
                    id="privacy-contact-title"
                    className={career.sectionHeading}
                  >
                    Dúvidas sobre os seus dados?
                  </h2>
                  <p className={styles.contactText}>
                    Se tiver dúvidas sobre esta política, contacte-nos:
                  </p>
                </header>
                <div data-reveal style={{ '--delay': '120ms' }}>
                  <a
                    href="mailto:contacto@empregostp.com"
                    className={`${career.primary} ${styles.contactEmail}`}
                  >
                    <FiMail aria-hidden="true" />
                    contacto@empregostp.com
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}
