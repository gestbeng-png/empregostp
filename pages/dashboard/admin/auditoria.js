import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import { FiClipboard } from 'react-icons/fi';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import adminStyles from '../../../styles/AdminPanel.module.css';

const TYPE_LABELS = {
  all: 'Todos os tipos',
  user_created: 'Utilizador criado',
  user_updated: 'Utilizador atualizado',
  user_deactivated: 'Utilizador desativado',
  job_created: 'Vaga criada',
  job_updated: 'Vaga atualizada',
  job_disabled: 'Vaga desativada',
  service_created: 'Serviço criado',
  service_updated: 'Serviço atualizado',
  service_deleted: 'Serviço excluído',
  plan_created: 'Plano criado',
  plan_updated: 'Plano atualizado',
  plan_deleted: 'Plano excluído',
  subscription_approved: 'Subscrição aprovada',
  subscription_rejected: 'Subscrição rejeitada',
  payment_settings_updated: 'Configurações de pagamento atualizadas',
  verification_approved: 'Verificação aprovada',
  verification_rejected: 'Verificação rejeitada',
};

const TYPE_COLORS = {
  user_created: '#0b6644',
  user_updated: '#3b82f6',
  user_deactivated: '#b91c1c',
  job_created: '#0b6644',
  job_updated: '#3b82f6',
  job_disabled: '#f59e0b',
  service_created: '#0b6644',
  service_updated: '#3b82f6',
  service_deleted: '#b91c1c',
  plan_created: '#0b6644',
  plan_updated: '#3b82f6',
  plan_deleted: '#b91c1c',
  subscription_approved: '#0b6644',
  subscription_rejected: '#b91c1c',
  payment_settings_updated: '#8b5cf6',
  verification_approved: '#0b6644',
  verification_rejected: '#b91c1c',
};

function getTypeColor(type) {
  return TYPE_COLORS[type] || '#4a5568';
}

function getTypeLabel(type) {
  return TYPE_LABELS[type] || type;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

const s = {
  page: {
    minHeight: '100vh',
    color: '#102441',
  },
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e4e5e8',
    borderRadius: '16px',
    padding: '1.5rem',
  },
  statCard: (color) => ({
    background: '#ffffff',
    border: `1px solid ${color}40`,
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
  }),
  input: {
    width: '100%',
    padding: '0.65rem 1rem',
    background: '#ffffff',
    border: '1px solid #cdd1d7',
    borderRadius: '8px',
    color: '#102441',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '0.65rem 1rem',
    background: '#ffffff',
    border: '1px solid #cdd1d7',
    borderRadius: '8px',
    color: '#102441',
    fontSize: '0.95rem',
    outline: 'none',
    cursor: 'pointer',
  },
  label: {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.85rem',
    color: '#4a5568',
    fontWeight: '600',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  th: {
    padding: '0.9rem 1rem',
    textAlign: 'left',
    color: '#4a5568',
    borderBottom: '1px solid #e4e5e8',
    fontWeight: '600',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.9rem 1rem',
    color: '#102441',
    borderBottom: '1px solid #eef1f4',
    fontSize: '0.9rem',
    verticalAlign: 'top',
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: '20px',
    fontSize: '0.72rem',
    fontWeight: '700',
    background: `${color}1f`,
    color: color,
    border: `1px solid ${color}55`,
    whiteSpace: 'nowrap',
  }),
  btn: {
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    transition: 'opacity 0.2s',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
  },
  secondaryBtn: {
    background: '#eef4f8',
    color: '#1d3357',
    border: '1px solid #cdd1d7',
  },
};

export default function AdminAuditoria() {
  const [activities, setActivities] = useState([]);
  const activitiesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [typeCounts, setTypeCounts] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [nextCursorId, setNextCursorId] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [pageSize] = useState(100);

  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  const countByType = (items = []) => {
    const counts = {};
    items.forEach((activity) => {
      counts[activity.type] = (counts[activity.type] || 0) + 1;
    });
    return counts;
  };

  const fetchActivities = useCallback(
    async (options = {}) => {
      const append = Boolean(options.append);
      const cursorIdParam = options.cursorId ? String(options.cursorId) : null;
      if (append && !cursorIdParam) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError('');
      }

      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          setError('Não autenticado');
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        const token = await user.getIdToken();

        const params = new URLSearchParams();
        if (filterType && filterType !== 'all') params.set('type', filterType);
        if (filterSearch) params.set('search', filterSearch);
        if (filterStartDate) params.set('startDate', filterStartDate);
        if (filterEndDate) params.set('endDate', filterEndDate);
        params.set('pageSize', String(pageSize));
        if (append && cursorIdParam) {
          params.set('cursorId', cursorIdParam);
        }

        const res = await fetch(`/api/admin/activities?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Erro ao carregar atividades');
        }

        const data = await res.json();
        const incoming = data.activities || [];
        const merged = append
          ? [
              ...activitiesRef.current,
              ...incoming.filter(
                (item) =>
                  !activitiesRef.current.some(
                    (existing) => existing.id === item.id,
                  ),
              ),
            ]
          : incoming;

        setActivities(merged);
        setTotal(
          Number.isFinite(Number(data.total))
            ? Number(data.total)
            : merged.length,
        );
        setTypeCounts(
          append
            ? countByType(merged)
            : data.typeCounts || countByType(incoming),
        );
        setHasMore(Boolean(data.hasMore));
        setNextCursorId(data.nextCursorId || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterType, filterSearch, filterStartDate, filterEndDate, pageSize],
  );

  useEffect(() => {
    fetchActivities({ append: false });
  }, [fetchActivities]);

  function handleClearFilters() {
    setFilterType('all');
    setFilterSearch('');
    setFilterStartDate('');
    setFilterEndDate('');
  }

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <>
      <Head>
        <title>Auditoria | Admin EmpregoSTP</title>
      </Head>
      <div style={s.page}>
        <div className={adminStyles.legacyPage} style={s.container}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link
              href="/dashboard/admin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#1d4ed8',
                textDecoration: 'none',
                fontWeight: '600',
                marginBottom: '0.75rem',
                fontSize: '0.9rem',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar ao Dashboard
            </Link>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    lineHeight: 1.1,
                  }}
                >
                  Auditoria
                </h1>
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    color: '#4a5568',
                    fontSize: '1rem',
                  }}
                >
                  Registo de todas as ações administrativas da plataforma
                </p>
              </div>
              <button
                onClick={fetchActivities}
                style={{
                  ...s.btn,
                  ...s.secondaryBtn,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Atualizar
              </button>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <div style={s.statCard('#3b82f6')}>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#4a5568',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.4rem',
                }}
              >
                Total de Ações
              </div>
              <div
                style={{ fontSize: '2rem', fontWeight: 900, color: '#1d4ed8' }}
              >
                {total}
              </div>
            </div>
            {topTypes.map(([type, count]) => (
              <div key={type} style={s.statCard(getTypeColor(type))}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#4a5568',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '0.4rem',
                  }}
                >
                  {getTypeLabel(type)}
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 900,
                    color: getTypeColor(type),
                  }}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ ...s.card, marginBottom: '1.5rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
                alignItems: 'end',
              }}
            >
              <div>
                <label htmlFor="audit-action-type" style={s.label}>
                  Tipo de ação
                </label>
                <select
                  id="audit-action-type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={s.select}
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="audit-search" style={s.label}>
                  Pesquisar
                </label>
                <input
                  id="audit-search"
                  type="search"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Descrição, utilizador..."
                  style={s.input}
                />
              </div>

              <div>
                <label htmlFor="audit-start-date" style={s.label}>
                  Data de início
                </label>
                <input
                  id="audit-start-date"
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  style={s.input}
                />
              </div>

              <div>
                <label htmlFor="audit-end-date" style={s.label}>
                  Data de fim
                </label>
                <input
                  id="audit-end-date"
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  style={s.input}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                }}
              >
                <button
                  onClick={fetchActivities}
                  style={{ ...s.btn, ...s.primaryBtn, flex: 1 }}
                >
                  Filtrar
                </button>
                <button
                  onClick={handleClearFilters}
                  style={{ ...s.btn, ...s.secondaryBtn }}
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: '1.5rem',
                padding: '1rem 1.25rem',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
                fontSize: '0.95rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Table */}
          <div style={s.card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #e4e5e8',
              }}
            >
              <span
                style={{ color: '#2d3f5c', fontSize: '0.95rem' }}
              >
                {loading
                  ? 'A carregar...'
                  : total > 0
                    ? `${activities.length} de ${total} registo${total !== 1 ? 's' : ''}`
                    : `${activities.length} registo${activities.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {loading ? (
              <div
                role="status"
                aria-live="polite"
                style={{ padding: '3rem', textAlign: 'center' }}
              >
                <div
                  className={`${adminStyles.spinner} ${adminStyles.spinnerLarge}`}
                />
                <p style={{ color: '#4a5568' }}>
                  A carregar registos de auditoria...
                </p>
              </div>
            ) : activities.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center' }}>
                <FiClipboard
                  aria-hidden="true"
                  size={42}
                  style={{ marginBottom: '1rem', color: 'var(--text-3)' }}
                />
                <p
                  style={{ color: '#4a5568', fontSize: '1.1rem' }}
                >
                  Nenhum registo encontrado
                </p>
                <p
                  style={{ color: '#6b7280', fontSize: '0.9rem' }}
                >
                  Tente ajustar os filtros ou aguarde que ações sejam registadas
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={s.th}>Data / Hora</th>
                      <th style={s.th}>Tipo</th>
                      <th style={s.th}>Descrição</th>
                      <th style={s.th}>Utilizador Afetado</th>
                      <th style={s.th}>Admin Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <tr
                        key={activity.id}
                        style={{ transition: 'background 0.15s' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            '#f8fafb')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = 'transparent')
                        }
                      >
                        <td
                          style={{
                            ...s.td,
                            whiteSpace: 'nowrap',
                            color: '#4a5568',
                            fontSize: '0.82rem',
                          }}
                        >
                          {formatDate(activity.createdAt)}
                        </td>
                        <td style={s.td}>
                          <span style={s.badge(getTypeColor(activity.type))}>
                            {getTypeLabel(activity.type)}
                          </span>
                        </td>
                        <td style={{ ...s.td, maxWidth: '380px' }}>
                          <span style={{ color: '#102441' }}>
                            {activity.description || '—'}
                          </span>
                        </td>
                        <td style={s.td}>
                          {activity.userId ? (
                            <Link
                              href={`/dashboard/admin/users/${activity.userId}`}
                              style={{
                                color: '#1d4ed8',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                              }}
                            >
                              {activity.userName || activity.userId}
                            </Link>
                          ) : (
                            <span style={{ color: '#6b7280' }}>
                              —
                            </span>
                          )}
                        </td>
                        <td style={s.td}>
                          {activity.adminId ? (
                            <Link
                              href={`/dashboard/admin/users/${activity.adminId}`}
                              style={{
                                color: '#6d28d9',
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                              }}
                            >
                              {activity.adminName || activity.adminId}
                            </Link>
                          ) : (
                            <span style={{ color: '#6b7280' }}>
                              Sistema
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Load more hint */}
          {!loading && hasMore && (
            <div
              style={{
                textAlign: 'center',
                marginTop: '1.5rem',
                display: 'grid',
                gap: '0.65rem',
                justifyItems: 'center',
              }}
            >
              <button
                onClick={() =>
                  fetchActivities({ append: true, cursorId: nextCursorId })
                }
                disabled={loadingMore}
                style={{
                  ...s.btn,
                  ...s.secondaryBtn,
                  opacity: loadingMore ? 0.7 : 1,
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                }}
              >
                {loadingMore ? 'A carregar mais...' : 'Carregar mais registos'}
              </button>
              <p
                style={{
                  color: '#4a5568',
                  fontSize: '0.85rem',
                  margin: 0,
                }}
              >
                Continue a carregar para ver registos mais antigos.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const authResult = await requireAdminPageAuth(context);
  if (!authResult.ok) {
    return { redirect: authResult.redirect };
  }

  return { props: {} };
}
