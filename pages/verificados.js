import Head from 'next/head';
import { FiShield } from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import VerifiedCandidatesCarousel from '../components/home/VerifiedCandidatesCarousel';
import { admin } from '../lib/firebaseAdmin';
import { fetchSpotlightCandidates } from '../lib/spotlightCandidates';
import { logServerError } from '../lib/serverLog';
import styles from '../styles/VerifiedCandidatesPage.module.css';

export default function VerifiedCandidatesPage({ candidates = [] }) {
  return (
    <PublicPageShell headerVariant="light">
      <Head>
        <title>Perfis verificados | EmpregoSTP</title>
        <meta name="description" content="Conheça os profissionais verificados disponíveis no EmpregoSTP." />
      </Head>
      <main className={styles.page}>
        <section className={styles.intro} aria-labelledby="verified-title">
          <span className={styles.eyebrow}><FiShield aria-hidden="true" /> Perfis verificados</span>
          <h1 id="verified-title">Quem já está verificado no EmpregoSTP</h1>
          <p>Profissionais com percurso confirmado pela nossa equipa. Verifique o seu perfil e apareça também aqui, à frente de quem contrata.</p>
        </section>
        <section className={styles.profiles} aria-labelledby="profiles-title">
          <h2 id="profiles-title">Perfis verificados</h2>
          <VerifiedCandidatesCarousel candidates={candidates} variante="larga" />
        </section>
      </main>
    </PublicPageShell>
  );
}

export async function getServerSideProps() {
  try {
    const candidates = await fetchSpotlightCandidates(admin);
    return { props: { candidates: JSON.parse(JSON.stringify(candidates)) } };
  } catch (error) {
    logServerError('verificados.carregar_perfis_falhou', error);
    return { props: { candidates: [] } };
  }
}
