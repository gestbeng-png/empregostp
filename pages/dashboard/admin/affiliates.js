import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import { useAuth } from '../../../context/AuthContext';
import styles from '../../../styles/AdminPanel.module.css';

const STATUS_META = {
  pending: {
    label: 'Pendente',
    style: {
      '--badge-bg': 'rgba(245, 158, 11, 0.14)',
      '--badge-color': 'var(--dash-warning-text, #b45309)',
      '--badge-border': '1px solid rgba(245, 158, 11, 0.28)',
    },
  },
  approved: {
    label: 'Aprovado',
    style: {
      '--badge-bg': 'rgba(61, 187, 122, 0.14)',
      '--badge-color': 'var(--dash-success-text, #15803d)',
      '--badge-border': '1px solid rgba(61, 187, 122, 0.28)',
    },
  },
  contacted: {
    label: 'Contactado',
    style: {
      '--badge-bg': 'rgba(32, 87, 215, 0.12)',
      '--badge-color': 'var(--dash-info-text, #1d4ed8)',
      '--badge-border': '1px solid rgba(32, 87, 215, 0.26)',
    },
  },
  rejected: {
    label: 'Rejeitado',
    style: {
      '--badge-bg': 'rgba(239, 68, 68, 0.12)',
      '--badge-color': 'var(--dash-danger-text, #b91c1c)',
      '--badge-border': '1px solid rgba(239, 68, 68, 0.24)',
    },
  },
};

const ROLE_LABEL = { candidato: 'Candidato', empresa: 'Empresa' };

const FILTERS = [
  {
    key: 'pending',
    title: 'Pendentes',
    accent: 'var(--dash-warning-text, #985800)',
  },
  {
    key: 'approved',
    title: 'Aprovados',
    accent: 'var(--dash-success-text, #0f6b41)',
  },
  {
    key: 'contacted',
    title: 'Contactados',
    accent: 'var(--dash-info-text, #064bb5)',
  },
  {
    key: 'rejected',
    title: 'Rejeitados',
    accent: 'var(--dash-danger-text, #b83d55)',
  },
  { key: 'all', title: 'Total', accent: 'var(--admin-muted)' },
];

export default function AdminAffiliates() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('pending');
  const [affiliates, setAffiliates] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    contacted: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchAffiliates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/affiliates?status=${filter}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setAffiliates(data.affiliates || []);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error('Erro ao carregar afiliados:', error);
      setFeedback({
        type: 'error',
        text: 'Não foi possível carregar as candidaturas.',
      });
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    fetchAffiliates();
  }, [fetchAffiliates]);

  const handleAction = useCallback(
    async (id, action) => {
      if (!user) return;
      if (
        action === 'delete' &&
        !window.confirm('Eliminar esta candidatura permanentemente?')
      ) {
        return;
      }
      setProcessingId(id);
      setFeedback(null);
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/admin/affiliates/${id}`, {
          method: action === 'delete' ? 'DELETE' : 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: action === 'delete' ? undefined : JSON.stringify({ action }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'Falha na operação');
        }
        const messages = {
          approve: 'Candidatura aprovada.',
          reject: 'Candidatura rejeitada.',
          contact: 'Marcado como contactado.',
          delete: 'Candidatura eliminada.',
        };
        setFeedback({ type: 'success', text: messages[action] });
        await fetchAffiliates();
      } catch (error) {
        console.error('Erro ao moderar afiliado:', error);
        setFeedback({
          type: 'error',
          text: error.message || 'Erro ao processar a ação.',
        });
      } finally {
        setProcessingId(null);
      }
    },
    [user, fetchAffiliates],
  );

  const activeCount = useMemo(() => affiliates.length, [affiliates]);

  return (
    <>
      <Head>
        <title>Afiliados - Admin</title>
      </Head>

      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonGhost} ${styles.buttonSmall}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar ao dashboard
            </Link>
            <h1 className={styles.headerTitle}>Programa de afiliados</h1>
            <p className={styles.headerSubtitle}>
              {stats.pending} pendente{stats.pending === 1 ? '' : 's'} ·{' '}
              {activeCount} {activeCount === 1 ? 'candidatura' : 'candidaturas'}{' '}
              no filtro atual.
            </p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.gridStats}`}>
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              aria-pressed={filter === item.key}
              className={`${styles.statCard} ${
                filter === item.key ? styles.statCardActive : ''
              }`}
              style={{
                '--accent-color': item.accent,
              }}
            >
              <p className={styles.statValue}>
                {item.key === 'all' ? stats.total : stats[item.key]}
              </p>
              <p className={styles.statLabel}>{item.title}</p>
            </button>
          ))}
        </section>

        {feedback ? (
          <section className={styles.section}>
            <div
              role="status"
              aria-live="polite"
              className={`${styles.alert} ${
                feedback.type === 'success'
                  ? styles.alertSuccess
                  : styles.alertError
              }`}
            >
              {feedback.text}
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>A carregar candidaturas...</p>
          </section>
        ) : affiliates.length === 0 ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>
              Nenhuma candidatura neste filtro.
            </p>
          </section>
        ) : (
          <section
            className={styles.section}
            style={{ display: 'grid', gap: '1rem' }}
          >
            {affiliates.map((item) => {
              const meta = STATUS_META[item.status] || STATUS_META.pending;
              return (
                <article
                  key={item.id}
                  className={`${styles.surface} ${styles.panel}`}
                  style={{ padding: '1.4rem 1.5rem' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 800,
                          color: 'var(--admin-text)',
                          fontSize: '1.05rem',
                        }}
                      >
                        {item.fullName}
                      </p>
                      <p
                        style={{
                          margin: '0.15rem 0 0',
                          color: 'var(--admin-muted)',
                          fontSize: '0.88rem',
                        }}
                      >
                        {ROLE_LABEL[item.role] || 'Utilizador'}
                        {item.occupation ? ` · ${item.occupation}` : ''}
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                    </div>
                    <span
                      className={`${styles.badge} ${styles.badgeSmall}`}
                      style={meta.style}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem 1.2rem',
                      margin: '0.9rem 0 0',
                    }}
                  >
                    <a
                      href={`mailto:${item.email}`}
                      style={{
                        color: 'var(--admin-blue)',
                        fontSize: '0.86rem',
                        fontWeight: 600,
                      }}
                    >
                      ✉️ {item.email}
                    </a>
                    <a
                      href={`tel:${item.phone}`}
                      style={{
                        color: 'var(--admin-blue)',
                        fontSize: '0.86rem',
                        fontWeight: 600,
                      }}
                    >
                      📞 {item.phone}
                    </a>
                    {item.channels ? (
                      <span
                        style={{
                          color: 'var(--admin-muted)',
                          fontSize: '0.86rem',
                        }}
                      >
                        🔗 {item.channels}
                      </span>
                    ) : null}
                  </div>

                  <p
                    style={{
                      margin: '0.7rem 0 0',
                      color: 'var(--text-2, var(--admin-text))',
                      lineHeight: 1.7,
                    }}
                  >
                    {item.motivation}
                  </p>

                  <p
                    style={{
                      margin: '0.7rem 0 0',
                      color: 'var(--admin-muted)',
                      fontSize: '0.8rem',
                    }}
                  >
                    Recebido em {formatDateTime(item.createdAt)}
                  </p>

                  <div
                    className={styles.buttonGroup}
                    style={{ marginTop: '1rem' }}
                  >
                    {item.status !== 'approved' ? (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleAction(item.id, 'approve')}
                        className={`${styles.buttonBase} ${styles.buttonSuccess} ${styles.buttonSmall}`}
                      >
                        Aprovar
                      </button>
                    ) : null}
                    {item.status !== 'contacted' ? (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleAction(item.id, 'contact')}
                        className={`${styles.buttonBase} ${styles.buttonGhost} ${styles.buttonSmall}`}
                      >
                        Marcar contactado
                      </button>
                    ) : null}
                    {item.status !== 'rejected' ? (
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleAction(item.id, 'reject')}
                        className={`${styles.buttonBase} ${styles.buttonGhost} ${styles.buttonSmall}`}
                      >
                        Rejeitar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleAction(item.id, 'delete')}
                      className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}

function formatDateTime(value) {
  if (!value) return 'Data não disponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não disponível';
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function getServerSideProps(context) {
  const result = await requireAdminPageAuth(context);
  if (!result.ok) {
    return { redirect: result.redirect };
  }
  return { props: {} };
}
