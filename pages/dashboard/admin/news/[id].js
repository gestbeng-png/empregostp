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
import { normalizeExternalUrl } from '../../../../lib/externalUrl';

const NEWS_DRAFT_FIELDS = [
  'title',
  'category',
  'date',
  'status',
  'content',
  'siteUrl',
  'formUrl',
  'publishedAt',
  'expiresAt',
];

/**
 * Valor para um <input type="datetime-local">: a hora tem de ser a local do
 * admin, não a UTC, senão a data desvia-se a cada edição fora do fuso de STP.
 */
function toLocalInputValue(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function prepareNewsDraft(value) {
  if (!value || typeof value !== 'object') return {};

  return NEWS_DRAFT_FIELDS.reduce((draft, field) => {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      draft[field] = value[field];
    }
    return draft;
  }, {});
}

export default function AdminNewsEdit({ newsData, isNew }) {
  const router = useRouter();
  const { user } = useAuth();
  const draftOwnerId = user?.uid || '';
  const draftResourceId = isNew
    ? 'new'
    : newsData?.id || String(router.query.id || '');
  const [loading, setLoading] = useState(false);
  const [appliedResourceId, setAppliedResourceId] = useState(
    isNew ? draftResourceId : '',
  );
  const [formData, setFormData] = useState({
    title: '',
    category: 'NOVIDADE',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    status: CONTENT_STATUS.PUBLISHED,
  });

  useEffect(() => {
    if (newsData) {
      setFormData(newsData);
      setAppliedResourceId(draftResourceId);
    } else if (isNew) {
      setAppliedResourceId(draftResourceId);
    }
  }, [draftResourceId, isNew, newsData]);
  const newsDraftKey = useMemo(
    () =>
      createFormDraftKey({
        scope: 'admin-news',
        ownerId: draftOwnerId,
        resourceId: draftResourceId,
      }),
    [draftOwnerId, draftResourceId],
  );

  const getDraftToken = useCallback(async () => {
    if (!user) return '';
    return user.getIdToken();
  }, [user]);

  const restoreNewsDraft = useCallback((draft) => {
    const restoredFields = prepareNewsDraft(draft);
    setFormData((current) => ({ ...current, ...restoredFields }));
  }, []);

  const {
    status: newsDraftStatus,
    lastSavedAt: newsDraftSavedAt,
    isOnline: newsDraftIsOnline,
    clearDraft: clearNewsDraft,
  } = useAutoDraft({
    storageKey: newsDraftKey,
    scope: 'admin-news',
    resourceId: draftResourceId,
    value: formData,
    onRestore: restoreNewsDraft,
    getToken: getDraftToken,
    enabled: Boolean(draftOwnerId && draftResourceId),
    ready: Boolean(draftResourceId && appliedResourceId === draftResourceId),
    baseUpdatedAt: isNew
      ? ''
      : newsData?.updatedAt || newsData?.createdAt || '',
    prepareLocal: prepareNewsDraft,
    prepareRemote: prepareNewsDraft,
  });

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
        // Guardamos só links http(s) válidos; o resto fica vazio.
        siteUrl: normalizeExternalUrl(formData.siteUrl),
        formUrl: normalizeExternalUrl(formData.formUrl),
        expiresAt: formData.expiresAt || '',
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

      await clearNewsDraft();

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
                color: '#4a5568',
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
            <AutoSaveStatus
              status={newsDraftStatus}
              lastSavedAt={newsDraftSavedAt}
              isOnline={newsDraftIsOnline}
            />
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
              <label htmlFor="news-site-url" style={styles.label}>
                Link do site (opcional)
              </label>
              <input
                id="news-site-url"
                aria-describedby="news-site-url-help"
                type="url"
                name="siteUrl"
                value={formData.siteUrl || ''}
                onChange={handleChange}
                style={styles.input}
                placeholder="https://exemplo.st/pagina"
              />
              <small
                id="news-site-url-help"
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  display: 'block',
                  marginTop: '5px',
                }}
              >
                Mostra o botão &quot;Ir ao site&quot; no aviso da página
                inicial.
              </small>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="news-form-url" style={styles.label}>
                Link do formulário (opcional)
              </label>
              <input
                id="news-form-url"
                aria-describedby="news-form-url-help"
                type="url"
                name="formUrl"
                value={formData.formUrl || ''}
                onChange={handleChange}
                style={styles.input}
                placeholder="https://forms.gle/..."
              />
              <small
                id="news-form-url-help"
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  display: 'block',
                  marginTop: '5px',
                }}
              >
                Mostra o botão &quot;Preencher formulário&quot; (inscrições,
                candidaturas, questionários).
              </small>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="news-published-at" style={styles.label}>
                Data de publicação (opcional)
              </label>
              <input
                id="news-published-at"
                type="datetime-local"
                name="publishedAt"
                value={toLocalInputValue(formData.publishedAt)}
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

            <div style={styles.formGroup}>
              <label htmlFor="news-expires-at" style={styles.label}>
                Deixa de aparecer em (opcional)
              </label>
              <input
                id="news-expires-at"
                aria-describedby="news-expires-at-help"
                type="datetime-local"
                name="expiresAt"
                value={toLocalInputValue(formData.expiresAt)}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    expiresAt: value ? new Date(value).toISOString() : '',
                  }));
                }}
                style={styles.input}
              />
              <small
                id="news-expires-at-help"
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  display: 'block',
                  marginTop: '5px',
                }}
              >
                A partir desta data a notícia sai do aviso da página inicial.
                Deixe vazio para ficar sem prazo.
              </small>
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
