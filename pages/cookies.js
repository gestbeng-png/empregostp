import Head from "next/head";
import Link from "next/link";
import PublicPageShell from "../components/PublicPageShell";
import styles from "../styles/LegalPage.module.css";

export default function CookiesPage() {
  return (
    <>
      <Head>
        <title>Cookies - EmpregoSTP</title>
        <meta
          name="description"
          content="Informações sobre cookies e tecnologias semelhantes no EmpregoSTP."
        />
      </Head>
      <PublicPageShell>
        <main className={styles.page}>
          <section className={styles.panel}>
            <h1 className={styles.title}>Cookies</h1>
            <div className={styles.copy}>
              <p>
                Utilizamos cookies e tecnologias semelhantes para manter sessões
                autenticadas, melhorar a navegação, medir o uso da plataforma e
                oferecer uma experiência mais estável para candidatos e
                empresas.
              </p>
              <p>
                Alguns cookies são necessários para o funcionamento do painel,
                enquanto outros são utilizados para análise e melhoria contínua
                do produto.
              </p>
              <Link href="/politica-privacidade" className={styles.link}>
                Ver política de privacidade completa
              </Link>
            </div>
          </section>
        </main>
      </PublicPageShell>
    </>
  );
}
