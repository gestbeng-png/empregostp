import LandingHeader from "./LandingHeader";
import Footer from "./home/Footer";
import styles from "../styles/PublicPageShell.module.css";

export default function PublicPageShell({
  children,
  headerVariant = "light",
  showFooter = true,
}) {
  return (
    <div className={styles.page}>
      <a href="#main-content" className="skipLink">
        Ir para o conteúdo
      </a>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={styles.orbPrimary} />
        <span className={styles.orbSecondary} />
        <span className={styles.orbTertiary} />
        <span className={styles.gridPattern} />
      </div>
      <LandingHeader variant={headerVariant} />
      <main id="main-content" className={styles.content}>
        {children}
      </main>
      {showFooter ? <Footer /> : null}
    </div>
  );
}
