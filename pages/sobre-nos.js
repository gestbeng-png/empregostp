import Head from "next/head";
import PublicPageShell from "../components/PublicPageShell";
import styles from "../styles/SobreNosPage.module.css";

export default function SobreNos() {
  return (
    <>
      <Head>
        <title>Sobre o Emprego STP</title>
        <meta
          name="description"
          content="Conheça a missão, visão e valores que guiam o Emprego STP."
        />
      </Head>

      <PublicPageShell>
        <main className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroPanel}>
              <p className={styles.heroKicker}>Sobre o Emprego STP</p>
              <h1 className={styles.heroTitle}>
                Oportunidades reais, acessíveis e humanas
              </h1>
              <p className={styles.heroText}>
                Conheça a missão, visão e valores que guiam o Emprego STP.
              </p>
            </div>
          </section>

          <div className={styles.sectionGrid}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionAccent} />
                <h2 className={styles.sectionTitle}>A nossa missão</h2>
              </div>
              <p className={styles.sectionText}>
                Facilitar o acesso ao emprego em São Tomé e Príncipe, tornando a
                procura e a divulgação de vagas mais rápidas, transparentes e
                humanas. Queremos aproximar quem precisa de trabalhar de quem
                precisa de contratar, com tecnologia simples e uma comunidade
                que se ajuda.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionAccent} />
                <h2 className={styles.sectionTitle}>A nossa visão</h2>
              </div>
              <p className={styles.sectionText}>
                Queremos um país onde encontrar emprego seja um processo
                organizado. Onde o talento dos jovens seja valorizado. Onde as
                empresas recrutem com confiança. Onde a tecnologia aproxime
                pessoas, em vez de excluir.
              </p>
            </section>
          </div>

          <section className={`${styles.section} ${styles.valuesSection}`}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionAccent} />
              <h2 className={styles.sectionTitle}>Os nossos valores</h2>
            </div>

            <div className={styles.valuesGrid}>
              <div className={styles.valueCard}>
                <h3>Transparência</h3>
                <p>com vagas claras e informação direta.</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Inclusão</h3>
                <p>com oportunidades para todos.</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Comunidade</h3>
                <p>com respeito e entreajuda.</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Responsabilidade</h3>
                <p>com propósito e compromisso.</p>
              </div>
              <div className={styles.valueCard}>
                <h3>Impacto</h3>
                <p>com resultados reais para o país.</p>
              </div>
            </div>
          </section>

          <div className={styles.bottomGrid}>
            <section className={styles.motto}>
              <p className={styles.mottoKicker}>O nosso lema</p>
              <h2>Cada vaga, uma árvore.</h2>
              <p>
                Acreditamos que progresso não é só ganhar mais. É cuidar melhor.
                Por isso, a cada vaga publicada, assumimos um compromisso com o
                futuro. Transformar oportunidades em impacto real. Para as
                pessoas e para o ambiente.
              </p>
            </section>

            <section id="contactos" className={styles.contact}>
              <h2>Contactos</h2>
              <p>
                Email: <span>emprego@stp.st</span>
              </p>
            </section>
          </div>
        </main>
      </PublicPageShell>
    </>
  );
}
