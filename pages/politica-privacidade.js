import Head from "next/head";
import PublicPageShell from "../components/PublicPageShell";
import styles from "../styles/LegalPage.module.css";

export default function PoliticaPrivacidade() {
  return (
    <>
      <Head>
        <title>Política de Privacidade - Emprego STP</title>
        <meta
          name="description"
          content="Política de Privacidade do Emprego STP."
        />
      </Head>

      <PublicPageShell>
        <main className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroPanel}>
              <p className={styles.heroKicker}>Política de Privacidade</p>
              <h1 className={styles.title}>
                A sua privacidade é uma prioridade
              </h1>
              <p className={styles.heroText}>
                Esta política explica como o Emprego STP recolhe, utiliza e
                protege os seus dados pessoais. Ao usar a plataforma, você
                concorda com os termos descritos abaixo.
              </p>
              <p className={styles.heroDate}>
                Última atualização: 2 de fevereiro de 2026
              </p>
            </div>
          </section>

          <div className={styles.stack}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span />
                Dados que recolhemos
              </h2>
              <ul>
                <li>Dados de conta: nome, email, telefone e tipo de perfil.</li>
                <li>
                  Dados profissionais: currículo, experiência, competências e
                  preferências.
                </li>
                <li>
                  Dados de navegação: páginas visitadas e interações com vagas.
                </li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span />
                Como utilizamos os dados
              </h2>
              <ul>
                <li>Para conectar candidatos a vagas relevantes e empresas.</li>
                <li>
                  Para melhorar a experiência da plataforma e os serviços
                  oferecidos.
                </li>
                <li>
                  Para enviar comunicações essenciais sobre candidaturas e
                  atualizações.
                </li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span />
                Partilha de informações
              </h2>
              <p>
                Partilhamos apenas o necessário para viabilizar a conexão entre
                candidatos e empresas. Não vendemos dados pessoais a terceiros.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span />
                Cookies e tecnologia
              </h2>
              <p>
                Utilizamos cookies para manter sessões ativas, melhorar a
                navegação e entender o uso da plataforma. Você pode ajustar as
                permissões no seu navegador.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span />
                Segurança
              </h2>
              <p>
                Adotamos práticas de segurança para proteger os seus dados.
                Apesar disso, nenhum sistema é 100% imune. Recomendamos manter
                suas credenciais em sigilo.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span />
                Direitos do utilizador
              </h2>
              <ul>
                <li>Aceder, atualizar ou corrigir informações pessoais.</li>
                <li>Solicitar a remoção da conta e dos dados associados.</li>
                <li>Esclarecer dúvidas sobre o tratamento de dados.</li>
              </ul>
            </section>

            <section className={styles.contact}>
              <h2>Fale connosco</h2>
              <p>Se tiver dúvidas sobre esta política, contacte-nos:</p>
              <p className={styles.contactEmail}>emprego@stp.st</p>
            </section>
          </div>
        </main>
      </PublicPageShell>
    </>
  );
}
