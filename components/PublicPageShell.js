import LandingHeader from './LandingHeader';
import Footer from './home/Footer';
import styles from '../styles/PublicPageShell.module.css';

export default function PublicPageShell({ children, headerVariant = 'default', showFooter = true }) {
  return (
    <div className={styles.page}>
      <LandingHeader variant={headerVariant} />
      <div className={styles.content}>{children}</div>
      {showFooter ? <Footer /> : null}
    </div>
  );
}
