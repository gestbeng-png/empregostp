import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import Head from 'next/head';
import Link from 'next/link';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';

const getStatusConfig = (status) => {
  switch (status) {
    case 'payment_submitted':
      return {
        label: 'Comprovativo enviado',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: '#93c5fd',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      };
    case 'approved':
      return {
        label: 'Aprovado',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      };
    case 'rejected':
      return {
        label: 'Rejeitado',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.3)'
      };
    default:
      return {
        label: 'Aguardando comprovativo',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: '#fbbf24',
        border: '1px solid rgba(245, 158, 11, 0.3)'
      };
  }
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
    const cursorIdParam = options.cursorIdParam ? String(options.cursorIdParam) : null;
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
        // Em produção, o redirect deve ser tratado pelo getServerSideProps ou middleware,
        // mas manteremos aqui como fallback
        return;
      }

      const params = new URLSearchParams();
      params.set('status', statusParam);
      params.set('pageSize', '40');
      if (append && cursorIdParam) {
        params.set('cursorId', cursorIdParam);
      }

      const res = await fetch(`/api/admin/subscription-requests?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Falha ao carregar pedidos');

      const data = await res.json();
      const incoming = data.requests || [];
      const merged = append
        ? [...requestsRef.current, ...incoming.filter((item) => !requestsRef.current.some((existing) => existing.id === item.id))]
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
    loadRequests({ append: false, statusParam: statusFilter, cursorIdParam: null });
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Falha ao processar pedido');

      setMessage(action === 'approve' ? 'Assinatura aprovada com sucesso' : 'Assinatura rejeitada');
      setNextCursorId(null);
      setHasMore(false);
      loadRequests({ append: false, statusParam: statusFilter, cursorIdParam: null }); // Recarregar lista
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
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
            color: white;
          }
        `}</style>
      </Head>
      <LandingHeader />

      <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem', minHeight: '100vh' }}>
        {/* Header Section */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '2rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: 'white', fontWeight: '900' }}>
              Solicitações de Assinatura
            </h1>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem' }}>
              Gerencie os pedidos de atualização de plano
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setNextCursorId(null);
                setHasMore(false);
                setStatusFilter(e.target.value);
              }}
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              <option value="all" style={{ color: '#0f172a' }}>Todos os status</option>
              <option value="pending" style={{ color: '#0f172a' }}>Aguardando comprovativo</option>
              <option value="payment_submitted" style={{ color: '#0f172a' }}>Comprovativo enviado</option>
              <option value="approved" style={{ color: '#0f172a' }}>Aprovados</option>
              <option value="rejected" style={{ color: '#0f172a' }}>Rejeitados</option>
            </select>
            <Link href="/dashboard/admin" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}>
              Voltar ao Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '12px',
            border: message.includes('sucesso') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: message.includes('sucesso') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.includes('sucesso') ? '#34d399' : '#fca5a5',
            fontWeight: '500'
          }}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            <div style={{
              width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)',
              borderTop: '3px solid #6366f1', borderRadius: '50%', margin: '0 auto 1rem',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            Carregando pedidos...
          </div>
        ) : requests.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            Nenhum pedido pendente encontrado.
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1.25rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Usuário</th>
                    <th style={{ padding: '1.25rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Plano</th>
                    <th style={{ padding: '1.25rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Preço</th>
                    <th style={{ padding: '1.25rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Data</th>
                    <th style={{ padding: '1.25rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Comprovativo</th>
                    <th style={{ padding: '1.25rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '1.25rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => {
                    const statusConfig = getStatusConfig(request.status);
                    const canApprove = request.status === 'payment_submitted' || (Number(request.price || 0) === 0 && request.status === 'pending');
                    return (
                    <tr key={request.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '1.25rem' }}>
                        <div style={{ fontWeight: '600', color: 'white' }}>{request.userName}</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.2rem' }}>{request.userEmail}</div>
                      </td>
                      <td style={{ padding: '1.25rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                        <span style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          fontSize: '0.85rem',
                          fontWeight: '500'
                        }}>
                          {request.planName}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem', color: 'white', fontWeight: '600' }}>{request.priceLabel}</td>
                      <td style={{ padding: '1.25rem', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                        {request.requestDate
                          ? new Date(request.requestDate.seconds ? request.requestDate.seconds * 1000 : request.requestDate).toLocaleDateString()
                          : '---'}
                      </td>
                      <td style={{ padding: '1.25rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                        {request.paymentProof?.url ? (
                          <div style={{ display: 'grid', gap: '0.35rem' }}>
                            <a
                              href={request.paymentProof.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#93c5fd', fontWeight: '600', textDecoration: 'none' }}
                            >
                              Abrir comprovativo
                            </a>
                            {request.paymentProof.note && (
                              <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>{request.paymentProof.note}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Ainda não enviado</span>
                        )}
                      </td>
                      <td style={{ padding: '1.25rem' }}>
                        <span style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          backgroundColor: statusConfig.backgroundColor,
                          color: statusConfig.color,
                          border: statusConfig.border
                        }}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                        {(request.status === 'pending' || request.status === 'payment_submitted') && (
                          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleAction(request.id, 'approve')}
                              disabled={loading || !canApprove}
                              style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                backgroundColor: canApprove ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.12)',
                                color: canApprove ? '#34d399' : '#94a3b8',
                                border: canApprove ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.18)',
                                cursor: canApprove ? 'pointer' : 'not-allowed',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                transition: 'all 0.2s'
                              }}
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => handleAction(request.id, 'reject')}
                              disabled={loading}
                              style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && hasMore && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => loadRequests({ append: true })}
              disabled={loadingMore}
              style={{
                padding: '0.65rem 1.2rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                color: 'white',
                fontWeight: '600',
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                opacity: loadingMore ? 0.7 : 1
              }}
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais pedidos'}
            </button>
          </div>
        )}
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  const authResult = await requireAdminPageAuth(context);
  if (!authResult.ok) {
    return authResult.redirect;
  }

  return { props: {} };
}
