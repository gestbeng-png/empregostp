import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import Head from 'next/head';
import Link from 'next/link';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import styles from '../../../styles/AdminPanel.module.css';

const getStatusConfig = (status) => {
  switch (status) {
    case 'payment_submitted':
      return {
        label: 'Comprovativo enviado',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: '#93c5fd',
        border: '1px solid rgba(59, 130, 246, 0.3)',
      };
    case 'approved':
      return {
        label: 'Aprovado',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: '#116e4b',
        border: '1px solid rgba(16, 185, 129, 0.3)',
      };
    case 'rejected':
      return {
        label: 'Rejeitado',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.3)',
      };
    default:
      return {
        label: 'Aguardando comprovativo',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: '#8a5a00',
        border: '1px solid rgba(245, 158, 11, 0.3)',
      };
  }
};

const getMessageTone = (message) => {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('sucesso') ||
    normalized.includes('aprovada') ||
    normalized.includes('aprovado')
    ? styles.alertSuccess
    : styles.alertError;
};

const formatRequestDate = (requestDate) => {
  if (!requestDate) return '---';

  const value = requestDate.seconds ? requestDate.seconds * 1000 : requestDate;
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '---';

  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function SubscriptionRequests() {
  const [requests, setRequests] = useState([]);
  const requestsRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursorId, setNextCursorId] = useState(null);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  const loadRequests = useCallback(async (options = {}) => {
    const append = Boolean(options.append);
    const statusParam = String(options.statusParam || 'all');
    const cursorIdParam = options.cursorIdParam
      ? String(options.cursorIdParam)
      : null;
    if (append && !cursorIdParam) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }

      const params = new URLSearchParams();
      params.set('status', statusParam);
      params.set('pageSize', '40');
      if (append && cursorIdParam) {
        params.set('cursorId', cursorIdParam);
      }

      const res = await fetch(
        `/api/admin/subscription-requests?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) throw new Error('Falha ao carregar pedidos');

      const data = await res.json();
      const incoming = data.requests || [];
      const merged = append
        ? [
            ...requestsRef.current,
            ...incoming.filter(
              (item) =>
                !requestsRef.current.some(
                  (existing) => existing.id === item.id,
                ),
            ),
          ]
        : incoming;

      setRequests(merged);
      setHasMore(Boolean(data.hasMore));
      setNextCursorId(data.nextCursorId || null);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      setMessage('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadRequests({
      append: false,
      statusParam: statusFilter,
      cursorIdParam: null,
    });
  }, [statusFilter, loadRequests]);

  async function handleAction(requestId, action) {
    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch(`/api/admin/subscription-requests/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.error || data.message || 'Falha ao processar pedido',
        );

      setMessage(
        action === 'approve'
          ? 'Assinatura aprovada com sucesso'
          : 'Assinatura rejeitada',
      );
      setNextCursorId(null);
      setHasMore(false);
      loadRequests({
        append: false,
        statusParam: statusFilter,
        cursorIdParam: null,
      });
    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      setMessage(error.message || 'Erro ao processar pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Solicitações de Assinatura - Admin</title>
      </Head>

      <div className={`${styles.page} ${styles.pageNarrow}`}>
        <div className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <h1 className={`${styles.headerTitle} ${styles.headerTitleSmall}`}>
              Solicitações de Assinatura
            </h1>
            <p className={styles.headerSubtitle}>
              Gerencie pedidos de atualização de plano e comprovativos
              recebidos.
            </p>
          </div>
          <div className={styles.headerActions}>
            <select
              aria-label="Filtrar solicitações por estado"
              value={statusFilter}
              onChange={(event) => {
                setNextCursorId(null);
                setHasMore(false);
                setStatusFilter(event.target.value);
              }}
              className={styles.selectControl}
            >
              <option value="all">Todos os status</option>
              <option value="pending">Aguardando comprovativo</option>
              <option value="payment_submitted">Comprovativo enviado</option>
              <option value="approved">Aprovados</option>
              <option value="rejected">Rejeitados</option>
            </select>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonAccent}`}
              style={{
                '--button-bg': 'rgba(255, 255, 255, 0.05)',
                '--button-border': 'rgba(255, 255, 255, 0.1)',
                '--button-color': '#fff',
              }}
            >
              Voltar ao Dashboard
            </Link>
          </div>
        </div>

        {message ? (
          <div
            role="status"
            aria-live="polite"
            className={`${styles.alert} ${getMessageTone(message)}`}
          >
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>A carregar pedidos...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              Nenhum pedido encontrado para este filtro.
            </p>
          </div>
        ) : (
          <div className={styles.tableShell}>
            <div className={`${styles.tableWrap} ${styles.tableWrapMin}`}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHeadRow}>
                    <th className={styles.tableHeadCell}>Utilizador</th>
                    <th className={styles.tableHeadCell}>Plano</th>
                    <th className={styles.tableHeadCell}>Preço</th>
                    <th className={styles.tableHeadCell}>Data</th>
                    <th className={styles.tableHeadCell}>Comprovativo</th>
                    <th className={styles.tableHeadCell}>Estado</th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => {
                    const statusConfig = getStatusConfig(request.status);
                    const canApprove =
                      request.status === 'payment_submitted' ||
                      (Number(request.price || 0) === 0 &&
                        request.status === 'pending');

                    return (
                      <tr key={request.id} className={styles.tableRow}>
                        <td className={styles.tableCell}>
                          <div className={styles.tableCellStrong}>
                            {request.userName}
                          </div>
                          <div className={styles.metaText}>
                            {request.userEmail}
                          </div>
                        </td>
                        <td className={styles.tableCell}>
                          <span
                            className={`${styles.badge} ${styles.badgeSmall}`}
                            style={{
                              '--badge-bg': 'rgba(99, 102, 241, 0.15)',
                              '--badge-color': '#4338ca',
                              '--badge-border':
                                '1px solid rgba(99, 102, 241, 0.3)',
                            }}
                          >
                            {request.planName}
                          </span>
                        </td>
                        <td
                          className={`${styles.tableCell} ${styles.tableCellStrong}`}
                        >
                          {request.priceLabel}
                        </td>
                        <td
                          className={`${styles.tableCell} ${styles.tableCellSoft}`}
                        >
                          {formatRequestDate(request.requestDate)}
                        </td>
                        <td className={styles.tableCell}>
                          {request.paymentProof?.url ? (
                            <div className={styles.proofStack}>
                              <a
                                href={request.paymentProof.url}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.proofLink}
                              >
                                Abrir comprovativo
                              </a>
                              {request.paymentProof.note ? (
                                <span className={styles.proofNote}>
                                  {request.paymentProof.note}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className={styles.tableCellSoft}>
                              Ainda não enviado
                            </span>
                          )}
                        </td>
                        <td className={styles.tableCell}>
                          <span
                            className={styles.badge}
                            style={{
                              '--badge-bg': statusConfig.backgroundColor,
                              '--badge-color': statusConfig.color,
                              '--badge-border': statusConfig.border,
                            }}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td
                          className={`${styles.tableCell} ${styles.alignCenter}`}
                        >
                          {request.status === 'pending' ||
                          request.status === 'payment_submitted' ? (
                            <div className={styles.buttonGroupCenter}>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAction(request.id, 'approve')
                                }
                                disabled={loading || !canApprove}
                                className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                                style={{
                                  '--button-bg': canApprove
                                    ? 'rgba(16, 185, 129, 0.18)'
                                    : 'rgba(148, 163, 184, 0.12)',
                                  '--button-border': canApprove
                                    ? 'rgba(16, 185, 129, 0.32)'
                                    : 'rgba(148, 163, 184, 0.18)',
                                  '--button-color': canApprove
                                    ? '#116e4b'
                                    : '#4a5568',
                                }}
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAction(request.id, 'reject')
                                }
                                disabled={loading}
                                className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
                              >
                                Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className={styles.tableCellSoft}>
                              Sem ações
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && hasMore ? (
          <div className={styles.loadMoreWrap}>
            <button
              type="button"
              onClick={() =>
                loadRequests({
                  append: true,
                  statusParam: statusFilter,
                  cursorIdParam: nextCursorId,
                })
              }
              disabled={loadingMore}
              className={`${styles.buttonBase} ${styles.buttonGhost}`}
            >
              {loadingMore ? 'A carregar...' : 'Carregar mais pedidos'}
            </button>
          </div>
        ) : null}
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
