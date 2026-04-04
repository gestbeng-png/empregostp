import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/LegalPage.module.css';

export default function TermosPage() {
  return (
    <>
      <Head>
        <title>Termos de Uso - EmpregoSTP</title>
        <meta name="description" content="Termos de uso da plataforma EmpregoSTP." />
      </Head>
      <main className={styles.page}>
        <section className={styles.panel}>
          <h1 className={styles.title}>Termos de Uso</h1>
          <div className={styles.copy}>
            <p>
              Ao utilizar o EmpregoSTP, você concorda em fornecer informações verdadeiras, utilizar a plataforma de forma lícita
              e respeitar candidatos, empresas e administradores durante todas as interações.
            </p>
            <p>
              Empresas são responsáveis pelo conteúdo das vagas publicadas e candidatos são responsáveis pelos dados enviados nos
              seus perfis e candidaturas. A utilização indevida da plataforma pode resultar em suspensão de acesso.
            </p>
            <p>
              Para mais detalhes sobre tratamento de dados e privacidade, consulte também a nossa política de privacidade.
            </p>
            <Link href="/politica-privacidade" className={styles.link}>
              Ver política de privacidade
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
