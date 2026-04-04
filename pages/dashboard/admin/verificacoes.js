import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import styles from '../../../styles/AdminPanel.module.css';

const STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    color: '#fbbf24',
    background: 'rgba(245, 158, 11, 0.18)',
    border: '1px solid rgba(245, 158, 11, 0.3)'
  },
  approved: {
    label: 'Aprovado',
    color: '#34d399',
    background: 'rgba(16, 185, 129, 0.18)',
    border: '1px solid rgba(16, 185, 129, 0.3)'
  },
  rejected: {
    label: 'Rejeitado',
    color: '#f87171',
    background: 'rgba(239, 68, 68, 0.18)',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  }
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function StatCard({ title, value, color }) {
  return (
    <div className={styles.statCard} style={{ '--accent-color': color }}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{title}</p>
    </div>
  );
}

export default function AdminVerificacoes() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState({ text: '', ok: true });
  const [modal, setModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setError('Não autenticado');
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/admin/verifications', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.message || 'Erro ao carregar verificações');
      }

      // Nota: em versões antigas o endpoint podia responder 304; tratamos isso como "recarregar".
      if (res.status === 304) {
        setVerifications((prev) => prev);
        return;
      }

      const data = await res.json().catch(() => ({}));
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          verificationId: verification.id,
          uid: verification.uid,
          action,
          reason: reason || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao processar');

      setMessage({
        text: action === 'approve'
          ? `Verificação de ${verification.candidateName} aprovada com sucesso!`
          : `Verificação de ${verification.candidateName} rejeitada.`,
        ok: action === 'approve'
      });

      setVerifications((prev) => prev.filter((item) => item.id !== verification.id));
      setModal(null);
      setRejectReason('');
    } catch (err) {
      setMessage({ text: err.message, ok: false });
    } finally {
      setProcessingId(null);
    }
  }

  const openModal = (verification, action) => {
    setRejectReason('');
    setModal({ verification, action });
  };

  const closeModal = () => {
    setModal(null);
    setRejectReason('');
  };

  const stats = {
    pending: verifications.filter((item) => item.status === 'pending').length,
    total: verifications.length
  };

  return (
    <>
      <Head>
        <title>Verificações | Admin EmpregoSTP</title>
      </Head>

      <LandingHeader />

      <main className={`${styles.page} ${styles.pageNarrow}`}>
        <div className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
              style={{ '--button-bg': 'rgba(255, 255, 255, 0.05)', '--button-border': 'rgba(255, 255, 255, 0.1)', '--button-color': '#93c5fd' }}
            >
              ← Voltar ao Dashboard
            </Link>
            <h1 className={styles.headerTitle}>Verificações</h1>
            <p className={styles.headerSubtitle}>Pedidos de verificação de identidade de candidatos em análise administrativa.</p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={fetchVerifications}
              disabled={loading}
              className={`${styles.buttonBase} ${styles.buttonAccent}`}
              style={{ '--button-bg': 'rgba(255, 255, 255, 0.08)', '--button-border': 'rgba(255, 255, 255, 0.12)', '--button-color': 'rgba(255, 255, 255, 0.85)' }}
            >
              Atualizar
            </button>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.gridStats}>
            <StatCard title="Pendentes" value={stats.pending} color="#f59e0b" />
            <StatCard title="Total carregados" value={stats.total} color="#64748b" />
          </div>
        </section>

        {message.text ? (
          <div className={`${styles.alert} ${message.ok ? styles.alertSuccess : styles.alertError}`}>
            {message.text}
          </div>
        ) : null}

        {error ? (
          <div className={`${styles.alert} ${styles.alertError}`}>
            {error}
          </div>
        ) : null}

        <section className={styles.section}>
          <div className={styles.tableShell}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p className={styles.loadingText}>A carregar verificações...</p>
              </div>
            ) : verifications.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>Nenhuma verificação pendente.</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadRow}>
                      <th className={styles.tableHeadCell}>Candidato</th>
                      <th className={styles.tableHeadCell}>Email</th>
                      <th className={styles.tableHeadCell}>Submetido em</th>
                      <th className={styles.tableHeadCell}>Status</th>
                      <th className={styles.tableHeadCell}>Documentos</th>
                      <th className={`${styles.tableHeadCell} ${styles.alignRight}`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((verification) => {
                      const status = STATUS_CONFIG[verification.status] || {
                        label: verification.status || '—',
                        color: '#94a3b8',
                        background: 'rgba(148, 163, 184, 0.18)',
                        border: '1px solid rgba(148, 163, 184, 0.3)'
                      };

                      return (
                        <tr key={verification.id} className={styles.tableRow}>
                          <td className={styles.tableCell}>
                            <Link href={`/dashboard/admin/users/${verification.uid}`} className={styles.proofLink}>
                              {verification.candidateName}
                            </Link>
                          </td>
                          <td className={`${styles.tableCell} ${styles.tableCellSoft}`}>{verification.candidateEmail}</td>
                          <td className={`${styles.tableCell} ${styles.tableCellSoft} ${styles.nowrap}`}>{formatDate(verification.submittedAt)}</td>
                          <td className={styles.tableCell}>
                            <span
                              className={styles.badge}
                              style={{ '--badge-bg': status.background, '--badge-color': status.color, '--badge-border': status.border }}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className={styles.tableCell}>
                            {verification.documents && Object.keys(verification.documents).length > 0 ? (
                              <div className={styles.buttonGroup}>
                                {Object.keys(verification.documents).map((docKey) => (
                                  <span
                                    key={docKey}
                                    className={`${styles.badge} ${styles.badgeSmall}`}
                                    style={{ '--badge-bg': 'rgba(255, 255, 255, 0.08)', '--badge-color': 'rgba(255, 255, 255, 0.72)', '--badge-border': '1px solid rgba(255, 255, 255, 0.08)' }}
                                  >
                                    {docKey}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={styles.tableCellSoft}>—</span>
                            )}
                          </td>
                          <td className={`${styles.tableCell} ${styles.alignRight}`}>
                            {verification.status === 'pending' ? (
                              <div className={styles.buttonGroup} style={{ justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  disabled={processingId === verification.id}
                                  onClick={() => openModal(verification, 'approve')}
                                  className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                                  style={{ '--button-bg': 'rgba(16, 185, 129, 0.15)', '--button-border': 'rgba(16,185,129,0.3)', '--button-color': '#34d399' }}
                                >
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId === verification.id}
                                  onClick={() => openModal(verification, 'reject')}
                                  className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                                  style={{ '--button-bg': 'rgba(239, 68, 68, 0.12)', '--button-border': 'rgba(239,68,68,0.3)', '--button-color': '#f87171' }}
                                >
                                  Rejeitar
                                </button>
                              </div>
                            ) : (
                              <span className={styles.tableCellSoft}>Processada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {modal ? (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modal.action === 'approve' ? 'Aprovar Verificação' : 'Rejeitar Verificação'}
              </h2>
              <p className={styles.modalSubtitle}>
                {modal.action === 'approve'
                  ? `Confirma a aprovação da verificação de ${modal.verification.candidateName}?`
                  : `Confirma a rejeição da verificação de ${modal.verification.candidateName}?`}
              </p>
            </div>

            {modal.action === 'reject' ? (
              <div className={styles.formField}>
                <label htmlFor="reject-reason" className={styles.formLabel}>Motivo da rejeição</label>
                <textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={4}
                  placeholder="Descreva o motivo da rejeição..."
                  className={styles.textareaControl}
                />
              </div>
            ) : null}

            <div className={styles.buttonGroupEnd} style={{ marginTop: '2rem' }}>
              <button type="button" onClick={closeModal} className={`${styles.buttonBase} ${styles.buttonGhost}`}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={processingId === modal.verification.id}
                onClick={() => processAction(modal.verification, modal.action, rejectReason)}
                className={`${styles.buttonBase} ${modal.action === 'approve' ? styles.buttonSuccess : styles.buttonDanger}`}
              >
                {processingId === modal.verification.id
                  ? 'A processar...'
                  : modal.action === 'approve'
                    ? 'Confirmar Aprovação'
                    : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
