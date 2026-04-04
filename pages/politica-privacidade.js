import Head from 'next/head';
import LandingHeader from '../components/LandingHeader';

export default function PoliticaPrivacidade() {
  return (
    <>
      <Head>
        <title>Política de Privacidade - Emprego STP</title>
        <meta name="description" content="Política de Privacidade do Emprego STP." />
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>

      <LandingHeader />

      <main className="policy-page">
        <section className="hero">
          <p className="hero-kicker">Política de Privacidade</p>
          <h1 className="hero-title">A sua privacidade é uma prioridade</h1>
          <p className="hero-text">
            Esta política explica como o Emprego STP recolhe, utiliza e protege os seus dados pessoais.
            Ao usar a plataforma, você concorda com os termos descritos abaixo.
          </p>
          <p className="hero-date">Última atualização: 2 de fevereiro de 2026</p>
        </section>

        <section className="section">
          <h2 className="section-title"><span />Dados que recolhemos</h2>
          <ul>
            <li>Dados de conta: nome, email, telefone e tipo de perfil.</li>
            <li>Dados profissionais: currículo, experiência, competências e preferências.</li>
            <li>Dados de navegação: páginas visitadas e interações com vagas.</li>
          </ul>
        </section>

        <section className="section">
          <h2 className="section-title"><span />Como utilizamos os dados</h2>
          <ul>
            <li>Para conectar candidatos a vagas relevantes e empresas.</li>
            <li>Para melhorar a experiência da plataforma e os serviços oferecidos.</li>
            <li>Para enviar comunicações essenciais sobre candidaturas e atualizações.</li>
          </ul>
        </section>

        <section className="section">
          <h2 className="section-title"><span />Partilha de informações</h2>
          <p>
            Partilhamos apenas o necessário para viabilizar a conexão entre candidatos e empresas.
            Não vendemos dados pessoais a terceiros.
          </p>
        </section>

        <section className="section">
          <h2 className="section-title"><span />Cookies e tecnologia</h2>
          <p>
            Utilizamos cookies para manter sessões ativas, melhorar a navegação e entender o uso da plataforma.
            Você pode ajustar as permissões no seu navegador.
          </p>
        </section>

        <section className="section">
          <h2 className="section-title"><span />Segurança</h2>
          <p>
            Adotamos práticas de segurança para proteger os seus dados. Apesar disso, nenhum sistema é 100% imune.
            Recomendamos manter suas credenciais em sigilo.
          </p>
        </section>

        <section className="section">
          <h2 className="section-title"><span />Direitos do utilizador</h2>
          <ul>
            <li>Aceder, atualizar ou corrigir informações pessoais.</li>
            <li>Solicitar a remoção da conta e dos dados associados.</li>
            <li>Esclarecer dúvidas sobre o tratamento de dados.</li>
          </ul>
        </section>

        <section className="contact">
          <h2>Fale connosco</h2>
          <p>Se tiver dúvidas sobre esta política, contacte-nos:</p>
          <p className="contact-email">emprego@stp.st</p>
        </section>
      </main>

      <style jsx>{`
        .policy-page {
          max-width: 1100px;
          margin: 2.5rem auto 4rem;
          padding: 0 2rem;
          color: #e2e8f0;
        }
        .hero {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(16, 185, 129, 0.12) 100%);
          border: 1px solid rgba(59, 130, 246, 0.22);
          border-radius: 26px;
          padding: 3rem;
          margin-bottom: 2.5rem;
          box-shadow: 0 18px 45px rgba(2, 6, 23, 0.45);
        }
        .hero-kicker {
          margin: 0 0 0.75rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          color: rgba(148, 163, 184, 0.8);
          font-weight: 800;
        }
        .hero-title {
          margin: 0 0 1rem;
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 900;
          color: #f8fafc;
        }
        .hero-text {
          margin: 0 0 1rem;
          font-size: 1.05rem;
          color: rgba(226, 232, 240, 0.9);
          line-height: 1.7;
          max-width: 760px;
        }
        .hero-date {
          margin: 0;
          font-size: 0.85rem;
          color: rgba(148, 163, 184, 0.8);
        }
        .section {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(30, 41, 59, 0.7);
          border-radius: 22px;
          padding: 2.2rem;
          margin-bottom: 2rem;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.35);
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 0 0 1rem;
          font-size: 1.4rem;
          font-weight: 800;
          color: #f8fafc;
        }
        .section-title span {
          width: 6px;
          height: 26px;
          border-radius: 999px;
          background: #3b82f6;
        }
        .section p {
          margin: 0;
          color: rgba(226, 232, 240, 0.85);
          line-height: 1.7;
        }
        .section ul {
          margin: 0;
          padding-left: 1.2rem;
          color: rgba(226, 232, 240, 0.85);
          display: grid;
          gap: 0.6rem;
        }
        .contact {
          text-align: center;
          padding: 2.2rem;
          border-radius: 22px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        .contact h2 {
          margin: 0 0 0.5rem;
          color: #f8fafc;
        }
        .contact-email {
          margin: 0.5rem 0 0;
          font-weight: 700;
          color: #93c5fd;
        }
        @media (max-width: 720px) {
          .policy-page {
            padding: 0 1.25rem;
          }
          .hero, .section, .contact {
            padding: 2rem 1.5rem;
          }
        }
      `}</style>
    </>
  );
}
