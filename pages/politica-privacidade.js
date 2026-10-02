import Head from 'next/head';
import PublicPageShell from '../components/PublicPageShell';
import styles from '../styles/LegalPage.module.css';

export default function PoliticaPrivacidade() {
  return (
    <>
      <Head>
        <title>Política de privacidade | EmpregoSTP</title>
        <meta
          name="description"
          content="Política de Privacidade do Emprego STP."
        />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroPanel}>
              <p className={styles.heroKicker}>Política de Privacidade</p>
              <h1 className={styles.title}>
                A sua privacidade é uma prioridade
              </h1>
              <p className={styles.heroText}>
                Esta política explica como o Emprego STP recolhe, utiliza e
                protege os seus dados pessoais. Ao utilizar a plataforma, o
                utilizador aceita os termos descritos abaixo.
              </p>
              <p className={styles.heroDate}>
                Última atualização: 2 de fevereiro de 2026
              </p>
            </div>
          </section>

          <div className={styles.stack}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Dados que recolhemos</h2>
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
              <h2 className={styles.sectionTitle}>Como utilizamos os dados</h2>
              <ul>
                <li>
                  Para aproximar candidatos de vagas relevantes e empresas.
                </li>
                <li>
                  Para melhorar a experiência da plataforma e os serviços
                  disponibilizados.
                </li>
                <li>
                  Para enviar comunicações essenciais sobre candidaturas e
                  atualizações.
                </li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Partilha de informações</h2>
              <p>
                Partilhamos apenas o necessário para permitir a ligação entre
                candidatos e empresas. Não vendemos dados pessoais a terceiros.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Cookies e tecnologia</h2>
              <p>
                Utilizamos cookies para manter sessões ativas, melhorar a
                navegação e compreender o uso da plataforma. Pode ajustar as
                permissões no seu navegador.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Segurança</h2>
              <p>
                Adotamos práticas de segurança para proteger os seus dados.
                Apesar disso, nenhum sistema é 100% imune. Recomendamos manter
                as credenciais em segurança.
              </p>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Direitos do utilizador</h2>
              <ul>
                <li>Aceder, atualizar ou corrigir informações pessoais.</li>
                <li>Solicitar a remoção da conta e dos dados associados.</li>
                <li>Esclarecer dúvidas sobre o tratamento de dados.</li>
              </ul>
            </section>

            <section className={styles.contact}>
              <h2>Fale connosco</h2>
              <p>Se tiver dúvidas sobre esta política, contacte-nos:</p>
              <a
                href="mailto:contacto@empregostp.com"
                className={styles.contactEmail}
              >
                contacto@empregostp.com
              </a>
            </section>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}
