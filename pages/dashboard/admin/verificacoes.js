import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';

const STATUS_COLORS = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
};

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)',
    color: '#fff',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
  },
  statCard: (color) => ({
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${color}40`,
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
  }),
  th: {
    padding: '0.9rem 1.25rem',
    textAlign: 'left',
    color: 'rgba(255,255,255,0.45)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    fontWeight: '600',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '1rem 1.25rem',
    color: 'rgba(255,255,255,0.85)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: '0.92rem',
    verticalAlign: 'middle',
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '0.25rem 0.7rem',
    borderRadius: '20px',
    fontSize: '0.72rem',
    fontWeight: '700',
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
  }),
  btn: {
    padding: '0.5rem 1rem',
    borderRadius: '7px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.85rem',
    transition: 'opacity 0.2s',
  },
  approveBtn: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16,185,129,0.3)',
  },
  rejectBtn: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.3)',
  },
};

export default function AdminVerificacoes() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState({ text: '', ok: true });

  // Modal state
  const [modal, setModal] = useState(null); // { verification, action }
  const [rejectReason, setRejectReason] = useState('');

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) { setError('Não autenticado'); setLoading(false); return; }
      const token = await user.getIdToken();

      const res = await fetch('/api/admin/verifications', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.message || 'Erro ao carregar verificações');
      }

      const data = await res.json();
      setVerifications(data.verifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  async function processAction(verification, action, reason = '') {
    setProcessingId(verification.id);
    setMessage({ text: '', ok: true });
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      const token = await user.getIdToken();

      const res = await fetch('/api/admin/verify-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verificationId: verification.id,
          uid: verification.uid,
          action,
          reason: reason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao processar');

      setMessage({
        text: action === 'approve'
          ? `Verificação de ${verification.candidateName} aprovada com sucesso!`
          : `Verificação de ${verification.candidateName} rejeitada.`,
        ok: action === 'approve',
      });

      // Remove from list
      setVerifications(prev => prev.filter(v => v.id !== verification.id));
      setModal(null);
      setRejectReason('');
    } catch (err) {
      setMessage({ text: err.message, ok: false });
    } finally {
      setProcessingId(null);
    }
  }

  function openModal(verification, action) {
    setRejectReason('');
    setModal({ verification, action });
  }

  function closeModal() {
    setModal(null);
    setRejectReason('');
  }

  const stats = {
    pending: verifications.filter(v => v.status === 'pending').length,
    total: verifications.length,
  };

  return (
    <>
      <Head>
        <title>Verificações | Admin EmpregoSTP</title>
      </Head>

      <div style={s.page}>
        <LandingHeader />
        <main style={s.container}>

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href="/dashboard/admin" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              color: '#60a5fa', textDecoration: 'none', fontWeight: '600',
              marginBottom: '0.75rem', fontSize: '0.9rem',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar ao Dashboard
            </Link>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.1 }}>
                  Verificações
                </h1>
                <p style={{ margin: '0.5rem 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '1rem' }}>
                  Pedidos de verificação de identidade de candidatos
                </p>
              </div>
              <button
                onClick={fetchVerifications}
                disabled={loading}
                style={{
                  padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
                  cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Atualizar
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={s.statCard('#f59e0b')}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Pendentes</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fbbf24' }}>{stats.pending}</div>
            </div>
            <div style={s.statCard('#64748b')}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Total carregados</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{stats.total}</div>
            </div>
          </div>

          {/* Feedback message */}
          {message.text && (
            <div style={{
              marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '10px',
              background: message.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${message.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: message.ok ? '#6ee7b7' : '#fca5a5', fontSize: '0.95rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{message.text}</span>
              <button
                onClick={() => setMessage({ text: '', ok: true })}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
              >×</button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '10px',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', fontSize: '0.95rem',
            }}>
              {error}
            </div>
          )}

          {/* Table */}
          <div style={s.card}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{
                  width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)',
                  borderTop: '3px solid #f59e0b', borderRadius: '50%',
                  animation: 'spin 1s linear infinite', margin: '0 auto 1rem',
                }} />
                <p style={{ color: 'rgba(255,255,255,0.5)' }}>A carregar verificações...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : verifications.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', fontWeight: '600' }}>
                  Nenhuma verificação pendente
                </p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>
                  Todas as solicitações foram processadas
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={s.th}>Candidato</th>
                      <th style={s.th}>Email</th>
                      <th style={s.th}>Submetido em</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}>Documentos</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map(v => (
                      <tr
                        key={v.id}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={s.td}>
                          <Link
                            href={`/dashboard/admin/users/${v.uid}`}
                            style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: '600' }}
                          >
                            {v.candidateName}
                          </Link>
                        </td>
                        <td style={{ ...s.td, color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>
                          {v.candidateEmail}
                        </td>
                        <td style={{ ...s.td, color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {formatDate(v.submittedAt)}
                        </td>
                        <td style={s.td}>
                          <span style={s.badge(STATUS_COLORS[v.status] || '#64748b')}>
                            {STATUS_LABELS[v.status] || v.status}
                          </span>
                        </td>
                        <td style={s.td}>
                          {v.documents && Object.keys(v.documents).length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {Object.keys(v.documents).map(docKey => (
                                <span key={docKey} style={{
                                  padding: '0.2rem 0.55rem', borderRadius: '4px',
                                  background: 'rgba(255,255,255,0.08)', fontSize: '0.75rem',
                                  color: 'rgba(255,255,255,0.6)',
                                }}>
                                  {docKey}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          {v.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button
                                disabled={processingId === v.id}
                                onClick={() => openModal(v, 'approve')}
                                style={{ ...s.btn, ...s.approveBtn, opacity: processingId === v.id ? 0.5 : 1 }}
                              >
                                Aprovar
                              </button>
                              <button
                                disabled={processingId === v.id}
                                onClick={() => openModal(v, 'reject')}
                                style={{ ...s.btn, ...s.rejectBtn, opacity: processingId === v.id ? 0.5 : 1 }}
                              >
                                Rejeitar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Confirmation Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}>
          <div style={{
            background: '#1e2840', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px', padding: '2rem', maxWidth: '480px', width: '100%',
          }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800 }}>
              {modal.action === 'approve' ? 'Aprovar Verificação' : 'Rejeitar Verificação'}
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
              {modal.action === 'approve'
                ? `Confirma a aprovação da verificação de ${modal.verification.candidateName}?`
                : `Confirma a rejeição da verificação de ${modal.verification.candidateName}?`}
            </p>

            {modal.action === 'reject' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block', marginBottom: '0.5rem',
                  fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)',
                  fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  Motivo da Rejeição (opcional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo da rejeição..."
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px', color: '#fff',
                    fontSize: '0.9rem', resize: 'vertical',
                    boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '0.65rem 1.25rem', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontWeight: '600',
                }}
              >
                Cancelar
              </button>
              <button
                disabled={processingId === modal.verification.id}
                onClick={() => processAction(modal.verification, modal.action, rejectReason)}
                style={{
                  padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none',
                  background: modal.action === 'approve'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff', cursor: processingId ? 'not-allowed' : 'pointer',
                  fontWeight: '700', opacity: processingId ? 0.6 : 1,
                }}
              >
                {processingId === modal.verification.id
                  ? 'A processar...'
                  : modal.action === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
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
