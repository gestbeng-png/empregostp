import Image from "next/image";
import styles from "../../styles/RedirectGate.module.css";

export default function RedirectGate({
  title = "Redirecionando",
  description,
}) {
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={`${styles.orb} ${styles.orbPrimary}`} />
        <span className={`${styles.orb} ${styles.orbSecondary}`} />
        <span className={`${styles.orb} ${styles.orbTertiary}`} />
        <span className={styles.gridPattern} />
      </div>

      <main className={styles.main}>
        <section className={styles.card}>
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

          <span className={styles.kicker}>Aguarde um instante</span>
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
