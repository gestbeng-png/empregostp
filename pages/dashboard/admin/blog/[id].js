import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import nookies from 'nookies';
import { admin } from '../../../../lib/firebaseAdmin';
import { serializeForProps } from '../../../../lib/firestoreNormalize';
import { useAuth } from '../../../../context/AuthContext';
import AutoSaveStatus from '../../../../components/forms/AutoSaveStatus';
import useAutoDraft from '../../../../hooks/useAutoDraft';
import { createFormDraftKey } from '../../../../lib/formDraft';
import adminStyles from '../../../../styles/AdminPanel.module.css';
import { addDocument, setDocument } from '../../../../lib/db';
import {
  CONTENT_STATUS,
  normalizeContentStatus,
  resolvePublishedAt,
} from '../../../../lib/contentPublication';
import { redirectToLogin } from '../../../../lib/loginRedirect';

const BLOG_DRAFT_FIELDS = [
  'title',
  'excerpt',
  'content',
  'category',
  'author',
  'image',
  'readTime',
  'color',
  'featured',
  'status',
  'publishedAt',
];

function prepareBlogDraft(value) {
  if (!value || typeof value !== 'object') return {};

  return BLOG_DRAFT_FIELDS.reduce((draft, field) => {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      draft[field] = value[field];
    }
    return draft;
  }, {});
}

export default function AdminBlogEdit({ postData, isNew }) {
  const router = useRouter();
  const { user } = useAuth();
  const draftOwnerId = user?.uid || '';
  const draftResourceId = isNew
    ? 'new'
    : postData?.id || String(router.query.id || '');
  const [loading, setLoading] = useState(false);
  const [appliedResourceId, setAppliedResourceId] = useState(
    isNew ? draftResourceId : '',
  );
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: 'Carreira',
    author: 'EmpregoSTP',
    image: '',
    readTime: '5 min',
    color: '#6366f1',
    featured: false,
    status: CONTENT_STATUS.PUBLISHED,
  });

  useEffect(() => {
    if (postData) {
      setFormData(postData);
      setAppliedResourceId(draftResourceId);
    } else if (isNew) {
      setAppliedResourceId(draftResourceId);
    }
  }, [draftResourceId, isNew, postData]);
  const blogDraftKey = useMemo(
    () =>
      createFormDraftKey({
        scope: 'admin-blog',
        ownerId: draftOwnerId,
        resourceId: draftResourceId,
      }),
    [draftOwnerId, draftResourceId],
  );

  const getDraftToken = useCallback(async () => {
    if (!user) return '';
    return user.getIdToken();
  }, [user]);

  const restoreBlogDraft = useCallback((draft) => {
    const restoredFields = prepareBlogDraft(draft);
    setFormData((current) => ({ ...current, ...restoredFields }));
  }, []);

  const {
    status: blogDraftStatus,
    lastSavedAt: blogDraftSavedAt,
    isOnline: blogDraftIsOnline,
    clearDraft: clearBlogDraft,
  } = useAutoDraft({
    storageKey: blogDraftKey,
    scope: 'admin-blog',
    resourceId: draftResourceId,
    value: formData,
    onRestore: restoreBlogDraft,
    getToken: getDraftToken,
    enabled: Boolean(draftOwnerId && draftResourceId),
    ready: Boolean(
      draftResourceId && appliedResourceId === draftResourceId,
    ),
    baseUpdatedAt: isNew
      ? ''
      : postData?.updatedAt || postData?.createdAt || '',
    prepareLocal: prepareBlogDraft,
    prepareRemote: prepareBlogDraft,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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

      let savedPostId = postData?.id;
      if (isNew) {
        savedPostId = await addDocument('posts', {
          ...payload,
          views: 0,
          createdAt: new Date().toISOString(),
        });
      } else {
        await setDocument('posts', postData.id, {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
      }

      await clearBlogDraft();

      // Se o artigo está publicado, envia automaticamente a newsletter aos
      // subscritores. O servidor só envia uma vez por artigo (guarda um
      // marcador), por isso editar um artigo já publicado não reenvia.
      if (normalizedStatus === CONTENT_STATUS.PUBLISHED && savedPostId) {
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
              body: JSON.stringify({ postId: savedPostId, type: 'blog' }),
            });
            const result = await resp.json().catch(() => ({}));
            if (resp.ok && typeof result.sent === 'number' && result.sent > 0) {
              alert(
                `Artigo publicado e newsletter enviada a ${result.sent} subscritor(es).`,
              );
            }
          }
        } catch (newsletterError) {
          // Não bloquear a publicação se o envio falhar.
          console.error('Falha ao enviar a newsletter:', newsletterError);
        }
      }

      router.push('/dashboard/admin/blog');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar o artigo. Verifique o console.');
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
      maxWidth: '800px',
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
    textarea: {
      width: '100%',
      padding: '0.8rem',
      background: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: 'white',
      fontSize: '1rem',
      minHeight: '200px',
      fontFamily: 'monospace',
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
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1.5rem',
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
          {isNew ? 'Novo Artigo' : 'Editar Artigo'} | Admin EmpregoSTP
        </title>
      </Head>
      <div className={adminStyles.legacyPage} style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <Link
              href="/dashboard/admin/blog"
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
              {isNew ? 'Novo Artigo' : 'Editar Artigo'}
            </h1>
            <AutoSaveStatus
              status={blogDraftStatus}
              lastSavedAt={blogDraftSavedAt}
              isOnline={blogDraftIsOnline}
            />
          </div>

          <form onSubmit={handleSubmit} style={styles.card}>
            <div style={styles.formGroup}>
              <label htmlFor="blog-title" style={styles.label}>
                Título
              </label>
              <input
                id="blog-title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label htmlFor="blog-category" style={styles.label}>
                  Categoria
                </label>
                <select
                  id="blog-category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="Carreira">Carreira</option>
                  <option value="Mercado">Mercado</option>
                  <option value="Dicas">Dicas</option>
                  <option value="Tecnologia">Tecnologia</option>
                  <option value="Entrevistas">Entrevistas</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label htmlFor="blog-status" style={styles.label}>
                  Estado de publicação
                </label>
                <select
                  id="blog-status"
                  name="status"
                  value={normalizeContentStatus(formData.status)}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value={CONTENT_STATUS.PUBLISHED}>Publicado</option>
                  <option value={CONTENT_STATUS.DRAFT}>Rascunho</option>
                </select>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label htmlFor="blog-author" style={styles.label}>
                  Autor
                </label>
                <input
                  id="blog-author"
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label htmlFor="blog-published-at" style={styles.label}>
                  Data de Publicação (opcional)
                </label>
                <input
                  id="blog-published-at"
                  type="datetime-local"
                  name="publishedAt"
                  value={
                    formData.publishedAt
                      ? new Date(formData.publishedAt)
                          .toISOString()
                          .slice(0, 16)
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
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="blog-excerpt" style={styles.label}>
                Resumo
              </label>
              <textarea
                id="blog-excerpt"
                name="excerpt"
                value={formData.excerpt}
                onChange={handleChange}
                style={{ ...styles.textarea, minHeight: '100px' }}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="blog-content" style={styles.label}>
                Conteúdo
              </label>
              <p
                id="blog-content-help"
                style={{
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  marginBottom: '0.5rem',
                }}
              >
                Use tags HTML para formatar (&lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;,
                etc.)
              </p>
              <textarea
                id="blog-content"
                aria-describedby="blog-content-help"
                name="content"
                value={formData.content}
                onChange={handleChange}
                style={styles.textarea}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="blog-image" style={styles.label}>
                URL da imagem de capa
              </label>
              <input
                id="blog-image"
                type="text"
                name="image"
                value={formData.image}
                onChange={handleChange}
                style={styles.input}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>

            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label htmlFor="blog-read-time" style={styles.label}>
                  Tempo de leitura
                </label>
                <input
                  id="blog-read-time"
                  type="text"
                  name="readTime"
                  value={formData.readTime}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label htmlFor="blog-color" style={styles.label}>
                  Cor do tema
                </label>
                <input
                  id="blog-color"
                  type="color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  style={{ ...styles.input, padding: '0.5rem', height: '50px' }}
                />
              </div>
            </div>

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Publicação'}
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

    let postData = null;

    if (!isNew) {
      const docSnap = await admin.firestore().collection('posts').doc(id).get();
      if (docSnap.exists) {
        postData = serializeForProps({
          id: docSnap.id,
          ...docSnap.data(),
        });
        postData.status = normalizeContentStatus(postData.status);
      } else {
        return { notFound: true };
      }
    }

    return {
      props: {
        postData,
        isNew,
      },
    };
  } catch (error) {
    console.error('Error in admin blog edit props:', error);
    return redirectToLogin(context);
  }
}
