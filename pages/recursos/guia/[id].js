import Head from 'next/head';
import Link from 'next/link';
import LandingHeader from '../../../components/LandingHeader';
import Footer from '../../../components/home/Footer';
import { admin } from '../../../lib/firebaseAdmin';
import { DEFAULT_GUIDES, GUIDE_CONTENTS } from '../../../lib/resourcesCatalog';

const toPlainText = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export default function GuiaDetalhePage({ guide }) {
  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#09090b',
      color: '#fff'
    },
    container: {
      maxWidth: '900px',
      margin: '0 auto',
      padding: '2rem'
    },
    breadcrumb: {
      color: '#94a3b8',
      textDecoration: 'none',
      fontSize: '0.9rem'
    },
    title: {
      margin: '1rem 0 0.4rem',
      fontSize: '2rem',
      fontWeight: 800
    },
    description: {
      margin: 0,
      color: '#a1a1aa',
      lineHeight: 1.7
    },
    meta: {
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap',
      marginTop: '1rem',
      marginBottom: '1rem',
      color: '#9ca3af',
      fontSize: '0.85rem'
    },
    button: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.55rem 0.85rem',
      background: 'rgba(99, 102, 241, 0.16)',
      border: '1px solid rgba(99, 102, 241, 0.35)',
      borderRadius: '8px',
      color: '#c7d2fe',
      textDecoration: 'none',
      fontWeight: 600,
      fontSize: '0.82rem'
    },
    contentCard: {
      marginTop: '1.2rem',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(255, 255, 255, 0.02)',
      padding: '1.15rem'
    },
    content: {
      margin: 0,
      color: '#e5e7eb',
      lineHeight: 1.8,
      whiteSpace: 'pre-wrap',
      fontSize: '0.95rem'
    }
  };

  return (
    <>
      <Head>
        <title>{guide.title} | Guia EmpregoSTP</title>
        <meta name="description" content={guide.description || 'Guia e manual de carreira no EmpregoSTP.'} />
      </Head>
      <div style={styles.page}>
        <LandingHeader />
        <main style={styles.container}>
          <Link href="/recursos" style={styles.breadcrumb}>
            {'<-'} Voltar para Recursos
          </Link>

          <h1 style={styles.title}>{guide.title}</h1>
          <p style={styles.description}>{guide.description}</p>

          <div style={styles.meta}>
            <span>{guide.category || 'Guia'}</span>
            {guide.readTime ? <span>{guide.readTime}</span> : null}
            {guide.pages ? <span>{guide.pages} paginas</span> : null}
          </div>

          {guide.downloadUrl ? (
            <a href={guide.downloadUrl} style={styles.button}>
              Baixar anexo
            </a>
          ) : null}

          <section style={styles.contentCard}>
            <pre style={styles.content}>
              {guide.content || 'Este guia ainda nao possui conteudo de texto.'}
            </pre>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const id = String(context?.params?.id || '').trim();
  if (!id) {
    return { notFound: true };
  }

  let guide = null;

  try {
    const guideDoc = await admin.firestore().collection('resources_guides').doc(id).get();
    if (guideDoc.exists) {
      const data = guideDoc.data() || {};
      guide = {
        id: guideDoc.id,
        title: data.title || 'Guia',
        description: data.description || '',
        category: data.category || 'Guia',
        readTime: data.readTime || '',
        pages: data.pages || '',
        downloadUrl: data.fileUrl || data.url || null,
        content: toPlainText(data.content || '')
      };
    }
  } catch (error) {
    console.error('Erro ao carregar guia por ID:', error);
  }

  if (!guide) {
    const fallbackGuide = DEFAULT_GUIDES.find((item) => item.id === id);
    if (fallbackGuide) {
      guide = {
        id: fallbackGuide.id,
        title: fallbackGuide.title || 'Guia',
        description: fallbackGuide.description || '',
        category: fallbackGuide.category || 'Guia',
        readTime: fallbackGuide.readTime || '',
        pages: fallbackGuide.pages || '',
        downloadUrl: null,
        content: toPlainText(GUIDE_CONTENTS[fallbackGuide.id] || '')
      };
    }
  }

  if (!guide) {
    return { notFound: true };
  }

  return {
    props: {
      guide
    }
  };
}
