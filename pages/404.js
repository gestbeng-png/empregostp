import Head from 'next/head';
import Link from 'next/link';
import { FiArrowRight, FiArrowUpRight, FiCompass } from 'react-icons/fi';

import PublicPageShell from '../components/PublicPageShell';
import styles from '../styles/NotFoundPage.module.css';

const routeIllustration = (
  <div className={styles.illustration} aria-hidden="true">
    <div className={styles.sheet}>
      <div className={styles.sheetHeader}>
        <span className={styles.compassMark}>
          <FiCompass />
        </span>
        <span>Mapa de oportunidades</span>
        <span className={styles.countryCode}>STP</span>
      </div>
      <div className={styles.drawing}>
        <svg className={styles.route} viewBox="0 0 440 290" fill="none">
          <path
            d="M-12 226H70C96 226 103 248 128 248H180C209 248 208 204 236 204H328C352 204 350 158 376 158H452"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="5 8"
            strokeLinecap="round"
          />
          <circle cx="70" cy="226" r="5" fill="currentColor" />
          <circle cx="376" cy="158" r="5" fill="currentColor" />
        </svg>
        <div className={styles.digits}>
          <span>4</span>
          <span className={styles.zero}>
            <svg viewBox="0 0 120 154" fill="none">
              <rect
                x="15"
                y="15"
                width="90"
                height="124"
                rx="45"
                stroke="currentColor"
                strokeWidth="28"
              />
            </svg>
            <span className={styles.pointer}>
              <FiArrowUpRight />
            </span>
          </span>
          <span>4</span>
        </div>
        <div className={styles.destination}>
          <span />
          Destino não encontrado
        </div>
      </div>
      <div className={styles.sheetFooter}>
        <span>O próximo passo?</span>
        <strong>Escolher um novo caminho.</strong>
        <FiArrowUpRight />
      </div>
    </div>
  </div>
);

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Página não encontrada | EmpregoSTP</title>
        <meta name="robots" content="noindex,follow" />
        <meta
          name="description"
          content="Esta página não foi encontrada. Volte ao início ou explore as vagas e os recursos do EmpregoSTP."
        />
      </Head>
      <PublicPageShell showFooter={false}>
        <div className={styles.page}>
          <section className={styles.layout} aria-labelledby="not-found-title">
            <div className={styles.copy}>
              <p className={styles.eyebrow}>
                <span>404</span>
                Página não encontrada
              </p>
              <h1 className={styles.title} id="not-found-title">
                Esta página não está <span>por aqui.</span>
              </h1>
              <p className={styles.description}>
                O endereço pode estar incorreto ou a página ter sido removida.
                As oportunidades continuam no EmpregoSTP.
              </p>
              <div className={styles.actions}>
                <Link href="/" className={styles.primaryLink}>
                  Voltar ao início
                  <FiArrowRight aria-hidden="true" />
                </Link>
                <Link href="/vagas" className={styles.secondaryLink}>
                  Explorar vagas
                  <FiArrowUpRight aria-hidden="true" />
                </Link>
              </div>
              <nav className={styles.shortcuts} aria-label="Outros caminhos">
                <Link href="/candidatos">
                  Para candidatos <FiArrowUpRight aria-hidden="true" />
                </Link>
                <Link href="/empresas">
                  Para empresas <FiArrowUpRight aria-hidden="true" />
                </Link>
              </nav>
            </div>
            {routeIllustration}
          </section>
          <footer className={styles.footer}>
            <p>
              <strong>EmpregoSTP</strong>
              <span aria-hidden="true">·</span>
              São Tomé e Príncipe
            </p>
            <Link href="/contacto">
              Precisa de ajuda? Fale connosco
              <FiArrowUpRight aria-hidden="true" />
            </Link>
          </footer>
        </div>
      </PublicPageShell>
    </>
  );
}
