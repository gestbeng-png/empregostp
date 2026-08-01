import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import nookies from 'nookies';
import { admin } from '../../../../lib/firebaseAdmin';
import { serializeForProps } from '../../../../lib/firestoreNormalize';
import adminStyles from '../../../../styles/AdminPanel.module.css';
import { addDocument, setDocument } from '../../../../lib/db';
import {
  CONTENT_STATUS,
  normalizeContentStatus,
  resolvePublishedAt,
} from '../../../../lib/contentPublication';
import { redirectToLogin } from '../../../../lib/loginRedirect';

export default function AdminNewsEdit({ newsData, isNew }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'NOVIDADE',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    status: CONTENT_STATUS.PUBLISHED,
  });

  useEffect(() => {
    if (newsData) {
      setFormData(newsData);
    }
  }, [newsData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedStatus = normalizeContentStatus(formData.status);
      const publishedAt = resolvePublishedAt({
        status: normalizedStatus,
        publishedAt: formData.publishedAt || null,
        fallbackDate: new Date().toISOString(),
      });
      const payload = {
        ...formData,
        status: normalizedStatus,
        publishedAt,
      };

      let savedNewsId = newsData?.id;
      if (isNew) {
        savedNewsId = await addDocument('news', {
          ...payload,
          createdAt: new Date().toISOString(),
        });
      } else {
        await setDocument('news', newsData.id, {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
      }

      // Envio automático da newsletter quando a notícia é publicada.
      // O servidor só envia uma vez por notícia (guarda um marcador).
      if (normalizedStatus === CONTENT_STATUS.PUBLISHED && savedNewsId) {
        try {
          const { getAuth } = await import('firebase/auth');
          const currentUser = getAuth().currentUser;
          if (currentUser) {
            const token = await currentUser.getIdToken();
            const resp = await fetch('/api/newsletter/broadcast', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ postId: savedNewsId, type: 'news' }),
            });
            const result = await resp.json().catch(() => ({}));
            if (resp.ok && typeof result.sent === 'number' && result.sent > 0) {
              alert(
                `Notícia publicada e newsletter enviada a ${result.sent} subscritor(es).`,
              );
            }
          }
        } catch (newsletterError) {
          console.error('Falha ao enviar a newsletter:', newsletterError);
        }
      }

      router.push('/dashboard/admin/news');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar notícia.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
      color: '#fff',
    },
    container: {
      maxWidth: '600px',
      margin: '0 auto',
      padding: '2rem',
    },
    header: {
      marginBottom: '2rem',
    },
    title: {
      fontSize: '2rem',
      fontWeight: 800,
      marginBottom: '0.5rem',
    },
    card: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
    },
    formGroup: {
      marginBottom: '1.5rem',
    },
    label: {
      display: 'block',
      marginBottom: '0.5rem',
      fontWeight: 600,
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '0.9rem',
    },
    input: {
      width: '100%',
      padding: '0.8rem',
      background: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '1rem',
    },
    select: {
      width: '100%',
      padding: '0.8rem',
      background: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '1rem',
    },
    submitBtn: {
      width: '100%',
      padding: '1rem',
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: '1rem',
      opacity: loading ? 0.7 : 1,
    },
  };

  return (
    <>
      <Head>
        <title>
          {isNew ? 'Nova Notícia' : 'Editar Notícia'} | Admin EmpregoSTP
        </title>
      </Head>
      <div className={adminStyles.legacyPage} style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <Link
              href="/dashboard/admin/news"
              style={{
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '0.9rem',
                marginBottom: '0.5rem',
                display: 'block',
              }}
            >
              ← Voltar a Lista
            </Link>
            <h1 style={styles.title}>
              {isNew ? 'Nova Notícia' : 'Editar Notícia'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} style={styles.card}>
            <div style={styles.formGroup}>
              <label htmlFor="news-title" style={styles.label}>
                Título
              </label>
              <input
                id="news-title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="news-category" style={styles.label}>
                Categoria
              </label>
              <select
                id="news-category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                style={styles.select}
              >
                <option value="NOVIDADE">NOVIDADE</option>
                <option value="PARCERIA">PARCERIA</option>
                <option value="DESTAQUE">DESTAQUE</option>
                <option value="ATUALIZAÇÂO">ATUALIZAÇÃO</option>
                <option value="EVENTO">EVENTO</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="news-status" style={styles.label}>
                Estado de publicação
              </label>
              <select
                id="news-status"
                name="status"
                value={normalizeContentStatus(formData.status)}
                onChange={handleChange}
                style={styles.select}
              >
                <option value={CONTENT_STATUS.PUBLISHED}>Publicado</option>
                <option value={CONTENT_STATUS.DRAFT}>Rascunho</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="news-date" style={styles.label}>
                Data de exibição
              </label>
              <input
                id="news-date"
                aria-describedby="news-date-help"
                type="text"
                name="date"
                value={formData.date}
                onChange={handleChange}
                style={styles.input}
                placeholder="ex: 12 Jan 2024"
                required
              />
              <small
                id="news-date-help"
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  display: 'block',
                  marginTop: '5px',
                }}
              >
                Formato livre (ex: &quot;Hoje&quot;, &quot;Há 2 dias&quot;,
                &quot;12/05/2024&quot;)
              </small>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="news-content" style={styles.label}>
                Conteúdo (opcional)
              </label>
              <textarea
                id="news-content"
                name="content"
                value={formData.content || ''}
                onChange={handleChange}
                style={{
                  ...styles.input,
                  minHeight: '150px',
                  resize: 'vertical',
                }}
                placeholder="Detalhes da notícia (HTML ou Texto)..."
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="news-published-at" style={styles.label}>
                Data de publicação (opcional)
              </label>
              <input
                id="news-published-at"
                type="datetime-local"
                name="publishedAt"
                value={
                  formData.publishedAt
                    ? new Date(formData.publishedAt).toISOString().slice(0, 16)
                    : ''
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    publishedAt: value ? new Date(value).toISOString() : '',
                  }));
                }}
                style={styles.input}
              />
            </div>

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Notícia'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const { id } = context.params;
  const isNew = id === 'novo';

  try {
    const cookies = nookies.get(context);
    if (!cookies.token) {
      return redirectToLogin(context);
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    // Check if admin
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    let newsData = null;

    if (!isNew) {
      const docSnap = await admin.firestore().collection('news').doc(id).get();
      if (docSnap.exists) {
        newsData = serializeForProps({
          id: docSnap.id,
          ...docSnap.data(),
        });
        newsData.status = normalizeContentStatus(newsData.status);
      } else {
        return { notFound: true };
      }
    }

    return {
      props: {
        newsData,
        isNew,
      },
    };
  } catch (error) {
    console.error('Error in admin news edit props:', error);
    return redirectToLogin(context);
  }
}
