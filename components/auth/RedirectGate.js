import Image from 'next/image';
import styles from '../../styles/RedirectGate.module.css';

export default function RedirectGate({ title = 'A encaminhar', description }) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section
          className={styles.card}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className={styles.logoWrap}>
            <Image
              src="/assets/Emprego STP Logo 2-wide.png"
              alt="EmpregoSTP"
              width={619}
              height={169}
              priority
              className={styles.logo}
            />
          </div>

          <span className={styles.kicker}>Só um instante</span>
          <h1 className={styles.title}>{title}</h1>
          {description ? (
            <p className={styles.description}>{description}</p>
          ) : null}

          <div className={styles.spinner} aria-hidden="true" />
        </section>
      </main>
    </div>
  );
}
