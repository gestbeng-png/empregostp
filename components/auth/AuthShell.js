import Image from 'next/image';
import Link from 'next/link';
import styles from '../../styles/AuthPage.module.css';

export default function AuthShell({
  tone = 'blue',
  minimal = false,
  wide = false,
  eyebrow,
  panelTitle,
  panelDescription,
  chips = [],
  children,
}) {
  const toneClass =
    tone === 'green' ? styles.brandPanelGreen : styles.brandPanelBlue;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {minimal ? (
          <section
            className={`${styles.shellMinimal} ${
              wide ? styles.shellMinimalWide : ''
            }`}
          >
            <section className={styles.formPanelCompact}>
              <Link
                href="/"
                className={styles.brandLinkMinimal}
                aria-label="Voltar à página inicial"
              >
                <Image
                  src="/assets/Emprego STP Logo.png"
                  alt="EmpregoSTP"
                  width={619}
                  height={169}
                  priority
                  className={styles.brandLogo}
                />
              </Link>

              <div
                className={`${styles.formPanelInner} ${
                  wide ? styles.formPanelInnerWide : ''
                }`}
              >
                {children}
              </div>
            </section>
          </section>
        ) : (
          <section className={styles.shell}>
            <aside className={`${styles.brandPanel} ${toneClass}`}>
              <Link
                href="/"
                className={styles.brandLink}
                aria-label="Voltar à página inicial"
              >
                <Image
                  src="/assets/Emprego STP Logo.png"
                  alt="EmpregoSTP"
                  width={619}
                  height={169}
                  priority
                  className={styles.brandLogo}
                />
              </Link>

              {eyebrow ? (
                <span className={styles.eyebrow}>{eyebrow}</span>
              ) : null}

              <div className={styles.brandCopy}>
                <h1 className={styles.brandTitle}>{panelTitle}</h1>
                {panelDescription ? (
                  <p className={styles.brandDescription}>{panelDescription}</p>
                ) : null}
              </div>

              {chips.length ? (
                <div className={styles.brandChips}>
                  {chips.map((chip) => (
                    <span key={chip} className={styles.brandChip}>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </aside>

            <section className={styles.formPanel}>
              <div className={styles.formPanelInner}>{children}</div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
