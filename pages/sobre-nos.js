import Head from 'next/head';
import LandingHeader from '../components/LandingHeader';

export default function SobreNos() {
  return (
    <>
      <Head>
        <title>Sobre o Emprego STP</title>
        <meta name="description" content="Conheça a missão, visão e valores do Emprego STP." />
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>

      <LandingHeader />

      <main className="about-page">
        <section className="hero">
          <p className="hero-kicker">Sobre o Emprego STP</p>
          <h1 className="hero-title">
            Oportunidades reais, acessíveis e humanas
          </h1>
          <p className="hero-text">
            Conheça a missão, visão e valores que guiam o Emprego STP.
          </p>
        </section>

        <section className="section">
          <h2 className="section-title"><span />A nossa missão</h2>
          <p className="section-text">
            Facilitar o acesso ao emprego em São Tomé e Príncipe, tornando a procura e a divulgação de vagas
            mais rápidas, transparentes e humanas. Queremos aproximar quem precisa de trabalhar de quem precisa
            de contratar, com tecnologia simples e uma comunidade que se ajuda.
          </p>
        </section>

        <section className="section">
          <h2 className="section-title"><span />A nossa visão</h2>
          <p className="section-text">
            Queremos um país onde encontrar emprego seja um processo organizado. Onde o talento dos jovens
            seja valorizado. Onde as empresas recrutem com confiança. Onde a tecnologia aproxime pessoas, em vez
            de excluir.
          </p>
        </section>

        <section className="section">
          <h2 className="section-title"><span />Os nossos valores</h2>
          <div className="values-grid">
            <div className="value-card">
              <h3>Transparência</h3>
              <p>com vagas claras e informação direta.</p>
            </div>
            <div className="value-card">
              <h3>Inclusão</h3>
              <p>com oportunidades para todos.</p>
            </div>
            <div className="value-card">
              <h3>Comunidade</h3>
              <p>com respeito e entreajuda.</p>
            </div>
            <div className="value-card">
              <h3>Responsabilidade</h3>
              <p>com propósito e compromisso.</p>
            </div>
            <div className="value-card">
              <h3>Impacto</h3>
              <p>com resultados reais para o país.</p>
            </div>
          </div>
        </section>

        <section className="motto">
          <p className="motto-kicker">O nosso lema</p>
          <h2>Cada vaga, uma árvore.</h2>
          <p>
            Acreditamos que progresso não é só ganhar mais. É cuidar melhor. Por isso, a cada vaga publicada,
            assumimos um compromisso com o futuro. Transformar oportunidades em impacto real. Para as pessoas e
            para o ambiente.
          </p>
        </section>

        <section className="contact">
          <h2>Contactos</h2>
          <p>
            Email: <span>emprego@stp.st</span>
          </p>
        </section>
      </main>

      <style jsx>{`
        .about-page {
          max-width: 1100px;
          margin: 2.5rem auto 4rem;
          padding: 0 2rem;
          color: #e2e8f0;
        }
        .hero {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.16) 0%, rgba(16, 185, 129, 0.12) 100%);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 24px;
          padding: 3rem;
          text-align: left;
          box-shadow: 0 18px 45px rgba(2, 6, 23, 0.45);
          margin-bottom: 2.5rem;
        }
        .hero-kicker {
          margin: 0 0 0.75rem;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          color: rgba(148, 163, 184, 0.8);
          font-weight: 800;
        }
        .hero-title {
          margin: 0 0 1.2rem;
          font-size: clamp(2.2rem, 4vw, 3rem);
          font-weight: 900;
          color: #f8fafc;
        }
        .hero-text {
          margin: 0 0 1rem;
          font-size: 1.05rem;
          color: rgba(226, 232, 240, 0.9);
          line-height: 1.7;
        }
        .section {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(30, 41, 59, 0.7);
          border-radius: 22px;
          padding: 2.2rem;
          margin-bottom: 2rem;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.4);
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
        .section-text {
          margin: 0;
          font-size: 1rem;
          color: rgba(226, 232, 240, 0.85);
          line-height: 1.7;
        }
        .values-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .value-card {
          padding: 1.2rem 1.4rem;
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.6);
          border: 1px solid rgba(30, 41, 59, 0.6);
        }
        .value-card h3 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          font-weight: 800;
          color: #93c5fd;
        }
        .value-card p {
          margin: 0;
          font-size: 0.9rem;
          color: rgba(226, 232, 240, 0.8);
        }
        .motto {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 24px;
          padding: 2.5rem;
          text-align: center;
          box-shadow: 0 18px 40px rgba(2, 6, 23, 0.45);
        }
        .motto-kicker {
          margin: 0 0 0.75rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          color: rgba(148, 163, 184, 0.7);
          font-weight: 800;
        }
        .motto h2 {
          margin: 0 0 1rem;
          font-size: 2rem;
          color: #38bdf8;
        }
        .motto p {
          margin: 0;
          font-size: 1rem;
          color: rgba(226, 232, 240, 0.85);
          line-height: 1.7;
        }
        .contact {
          margin-top: 2rem;
          padding: 2rem;
          border-radius: 22px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(59, 130, 246, 0.25);
          text-align: center;
        }
        .contact h2 {
          margin: 0 0 0.75rem;
          font-size: 1.6rem;
          color: #f8fafc;
        }
        .contact p {
          margin: 0;
          color: rgba(226, 232, 240, 0.85);
          font-size: 1rem;
        }
        .contact span {
          color: #93c5fd;
          font-weight: 700;
        }
        @media (max-width: 720px) {
          .about-page {
            padding: 0 1.25rem;
          }
          .hero, .section, .motto {
            padding: 2rem 1.5rem;
          }
        }
      `}</style>
    </>
  );
}
