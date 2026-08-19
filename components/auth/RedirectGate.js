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
              src="/assets/Logo header.png"
              alt="EmpregoSTP"
              width={219}
              height={59}
              priority
              sizes="(max-width: 380px) 150px, (max-width: 640px) 164px, (max-width: 1240px) 170px, 184px"
              className={styles.logo}
            />
          </div>

          <div className={styles.copy}>
            <h1 className={styles.title}>{title}</h1>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : null}
          </div>

          <div className={styles.spinner} aria-hidden="true" />
        </section>
      </main>
    </div>
  );
}
