import Head from 'next/head';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <>
      <Head>
        <title>Sem ligação - EmpregoSTP</title>
      </Head>
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background: 'radial-gradient(circle at top, rgba(37, 99, 235, 0.18), transparent 35%), linear-gradient(180deg, #020617 0%, #0f172a 100%)'
      }}>
        <section style={{
          width: 'min(560px, 100%)',
          padding: '2rem',
          borderRadius: '28px',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          background: 'rgba(15, 23, 42, 0.88)',
          boxShadow: '0 24px 70px rgba(2, 6, 23, 0.42)'
        }}>
          <span style={{
            display: 'inline-flex',
            padding: '0.45rem 0.8rem',
            borderRadius: '999px',
            background: 'rgba(59, 130, 246, 0.14)',
            color: '#93c5fd',
            fontWeight: 700,
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>
            Offline
          </span>
          <h1 style={{ color: '#fff', fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '1rem 0 0.75rem' }}>
            Está sem ligação à internet.
          </h1>
          <p style={{ color: '#cbd5e1', lineHeight: 1.7, margin: 0 }}>
            Quando a ligação voltar, poderá continuar a consultar vagas, mensagens e o seu painel. Entretanto, pode voltar à página inicial ou tentar novamente.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 'none',
                borderRadius: '14px',
                padding: '0.95rem 1.15rem',
                background: 'linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Tentar novamente
            </button>
            <Link href="/" style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '14px',
              padding: '0.95rem 1.15rem',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              textDecoration: 'none',
              fontWeight: 700
            }}>
              Voltar ao início
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
