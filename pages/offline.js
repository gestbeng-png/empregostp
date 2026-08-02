import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { FiHome, FiRefreshCw, FiWifiOff } from 'react-icons/fi';
import styles from '../styles/OfflinePage.module.css';

export default function OfflinePage() {
  return (
    <>
      <Head>
        <title>Sem ligação | EmpregoSTP</title>
        <meta
          name="description"
          content="Estado sem ligação à internet da plataforma EmpregoSTP."
        />
      </Head>

      <main className={styles.page}>
        <section className={styles.panel} aria-labelledby="offline-title">
          <Link
            href="/"
            className={styles.brandLink}
            aria-label="EmpregoSTP, página inicial"
          >
            <Image
              src="/assets/Emprego STP Logo.png"
              alt="EmpregoSTP"
              width={619}
              height={169}
              priority
              unoptimized
              className={styles.logo}
            />
          </Link>

          <span className={styles.eyebrow}>
            <FiWifiOff aria-hidden="true" />
            Sem ligação
          </span>
          <h1 id="offline-title">Não foi possível ligar à internet</h1>
          <p>
            Verifique a ligação e tente novamente. Quando a rede estiver
            disponível, poderá retomar a navegação a partir do ponto onde parou.
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={styles.primaryButton}
            >
              <FiRefreshCw aria-hidden="true" />
              Tentar novamente
            </button>
            <Link href="/" className={styles.secondaryButton}>
              <FiHome aria-hidden="true" />
              Ir para o início
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
