import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import { VERIFICATION_TYPE_CONFIG } from '../../../lib/candidateVerification';
import styles from '../../../styles/AdminPanel.module.css';

const STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    color: '#fbbf24',
    background: 'rgba(245, 158, 11, 0.18)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
  },
  approved: {
    label: 'Aprovado',
    color: '#34d399',
    background: 'rgba(16, 185, 129, 0.18)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  rejected: {
    label: 'Rejeitado',
    color: '#f87171',
    background: 'rgba(239, 68, 68, 0.18)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  partial: {
    label: 'Parcial',
    color: '#60a5fa',
    background: 'rgba(59, 130, 246, 0.18)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  draft: {
    label: 'Rascunho',
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.18)',
    border: '1px solid rgba(148, 163, 184, 0.3)',
  },
};

const TYPE_ORDER = ['identity', 'certificates', 'academic', 'experience', 'competencies'];

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

function StatCard({ title, value, color }) {
  return (
    <div className={styles.statCard} style={{ '--accent-color': color }}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{title}</p>
    </div>
  );
}

function getOrderedItems(verification) {
  const itemMap = verification?.verificationItems || {};
  return TYPE_ORDER
    .map((type) => itemMap[type])
    .filter((item) => item && item.requested);
}

export default function AdminVerificacoes() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingKey, setProcessingKey] = useState('');
  const [message, setMessage] = useState({ text: '', ok: true });
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [reviewReason, setReviewReason] = useState('');

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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.message || 'Erro ao carregar verificações');
      }

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

  async function processAction(verification, action, verificationType = null) {
    const processingId = `${verification.id}:${verificationType || 'all'}:${action}`;
    setProcessingKey(processingId);
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
          reason: reviewReason || undefined,
          verificationType: verificationType || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Erro ao processar');

      const nextVerification = data.verification
        ? {
            ...verification,
            ...data.verification,
            candidateName: verification.candidateName,
            candidateEmail: verification.candidateEmail,
          }
        : null;

      if (nextVerification) {
        setVerifications((prev) =>
          prev.map((item) => (item.id === verification.id ? nextVerification : item))
        );
        setSelectedVerification(nextVerification);
      }

      const typeLabel = verificationType
        ? VERIFICATION_TYPE_CONFIG[verificationType]?.label || verificationType
        : 'pedido';

      setMessage({
        text:
          action === 'approve'
            ? `${typeLabel} de ${verification.candidateName} aprovado com sucesso.`
            : `${typeLabel} de ${verification.candidateName} rejeitado.`,
        ok: action === 'approve',
      });

      setReviewReason('');
    } catch (err) {
      setMessage({ text: err.message, ok: false });
    } finally {
      setProcessingKey('');
    }
  }

  const stats = useMemo(() => ({
    pending: verifications.filter((item) => item.summary?.pendingCount > 0).length,
    verified: verifications.filter((item) => item.summary?.publicVerified).length,
    total: verifications.length,
  }), [verifications]);

  const closeModal = () => {
    setSelectedVerification(null);
    setReviewReason('');
  };

  const requestedTypeCount = (verification) => getOrderedItems(verification).length;

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
            <p className={styles.headerSubtitle}>Painel por tipo de verificação, com checklist e evidências por candidato.</p>
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
            <StatCard title="Com itens pendentes" value={stats.pending} color="#f59e0b" />
            <StatCard title="Perfis públicos verificados" value={stats.verified} color="#10b981" />
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
                <p className={styles.emptyText}>Nenhuma verificação encontrada.</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadRow}>
                      <th className={styles.tableHeadCell}>Candidato</th>
                      <th className={styles.tableHeadCell}>Email</th>
                      <th className={styles.tableHeadCell}>Última submissão</th>
                      <th className={styles.tableHeadCell}>Tipos</th>
                      <th className={styles.tableHeadCell}>Resumo</th>
                      <th className={styles.tableHeadCell}>Status</th>
                      <th className={`${styles.tableHeadCell} ${styles.alignRight}`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((verification) => {
                      const status = STATUS_CONFIG[verification.status] || STATUS_CONFIG.draft;
                      return (
                        <tr key={verification.id} className={styles.tableRow}>
                          <td className={styles.tableCell}>
                            <Link href={`/dashboard/admin/users/${verification.uid}`} className={styles.proofLink}>
                              {verification.candidateName}
                            </Link>
                          </td>
                          <td className={`${styles.tableCell} ${styles.tableCellSoft}`}>{verification.candidateEmail}</td>
                          <td className={`${styles.tableCell} ${styles.tableCellSoft} ${styles.nowrap}`}>{formatDate(verification.updatedAt || verification.submittedAt)}</td>
                          <td className={styles.tableCell}>
                            <span className={`${styles.badge} ${styles.badgeSmall}`} style={{ '--badge-bg': 'rgba(255,255,255,0.08)', '--badge-color': '#e2e8f0', '--badge-border': '1px solid rgba(255,255,255,0.08)' }}>
                              {requestedTypeCount(verification)} tipo(s)
                            </span>
                          </td>
                          <td className={`${styles.tableCell} ${styles.tableCellSoft}`}>
                            {verification.summary
                              ? `${verification.summary.approvedCount || 0} aprovados • ${verification.summary.pendingCount || 0} pendentes`
                              : '—'}
                          </td>
                          <td className={styles.tableCell}>
                            <span
                              className={styles.badge}
                              style={{ '--badge-bg': status.background, '--badge-color': status.color, '--badge-border': status.border }}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className={`${styles.tableCell} ${styles.alignRight}`}>
                            <button
                              type="button"
                              onClick={() => setSelectedVerification(verification)}
                              className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                              style={{ '--button-bg': 'rgba(59, 130, 246, 0.2)', '--button-border': 'rgba(59, 130, 246, 0.3)', '--button-color': '#60a5fa' }}
                            >
                              Ver detalhes
                            </button>
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

      {selectedVerification ? (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Painel de revisão</h2>
              <p className={styles.modalSubtitle}>
                {selectedVerification.candidateName} • {selectedVerification.candidateEmail}
              </p>
            </div>

            <div className={styles.modalBodyStack}>
              <div className={styles.modalInfoCard}>
                <h3 className={styles.modalInfoTitle}>Resumo</h3>
                <div className={styles.buttonGroup}>
                  <span className={styles.badge} style={{ '--badge-bg': 'rgba(59, 130, 246, 0.14)', '--badge-color': '#93c5fd', '--badge-border': '1px solid rgba(59, 130, 246, 0.2)' }}>
                    {selectedVerification.summary?.approvedCount || 0} aprovados
                  </span>
                  <span className={styles.badge} style={{ '--badge-bg': 'rgba(245, 158, 11, 0.14)', '--badge-color': '#fbbf24', '--badge-border': '1px solid rgba(245, 158, 11, 0.2)' }}>
                    {selectedVerification.summary?.pendingCount || 0} pendentes
                  </span>
                  <span className={styles.badge} style={{ '--badge-bg': 'rgba(239, 68, 68, 0.14)', '--badge-color': '#f87171', '--badge-border': '1px solid rgba(239, 68, 68, 0.2)' }}>
                    {selectedVerification.summary?.rejectedCount || 0} rejeitados
                  </span>
                </div>
              </div>

              <div className={styles.formField}>
                <label htmlFor="review-reason" className={styles.formLabel}>Nota de revisão</label>
                <textarea
                  id="review-reason"
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                  rows={3}
                  placeholder="Opcional. Pode justificar aprovação/rejeição por tipo."
                  className={styles.textareaControl}
                />
              </div>

              <div className={styles.verificationReviewGrid}>
                {getOrderedItems(selectedVerification).map((item) => {
                  const itemStatus = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                  return (
                    <article key={item.type} className={styles.verificationReviewCard}>
                      <div className={styles.verificationReviewHeader}>
                        <div>
                          <h3 className={styles.verificationReviewTitle}>{item.label}</h3>
                          <p className={styles.verificationReviewText}>{item.description}</p>
                        </div>
                        <span
                          className={styles.badge}
                          style={{ '--badge-bg': itemStatus.background, '--badge-color': itemStatus.color, '--badge-border': itemStatus.border }}
                        >
                          {itemStatus.label}
                        </span>
                      </div>

                      <div className={styles.verificationChecklistAdmin}>
                        {item.checklist?.map((check) => (
                          <div key={`${item.type}-${check.id}`} className={styles.verificationChecklistAdminItem}>
                            <span className={check.completed ? styles.verificationCheckDone : styles.verificationCheckPending}>
                              {check.completed ? '✓' : '•'}
                            </span>
                            <div>
                              <strong>{check.label}</strong>
                              {check.hint ? <p>{check.hint}</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>

                      {item.evidence?.length ? (
                        <div className={styles.verificationEvidenceList}>
                          {item.evidence.map((evidence) => (
                            <div key={evidence.id} className={styles.verificationEvidenceItem}>
                              <strong>{evidence.label}</strong>
                              {evidence.url ? (
                                <a href={evidence.url} target="_blank" rel="noreferrer" className={styles.proofLink}>
                                  Abrir evidência
                                </a>
                              ) : (
                                <p>{evidence.text || 'Sem detalhe textual.'}</p>
                              )}
                              <span>{evidence.source === 'submission' ? 'Submetido no pedido' : 'Puxado do perfil atual'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.proofNote}>Sem evidências anexadas neste tipo.</p>
                      )}

                      {item.status === 'pending' ? (
                        <div className={styles.buttonGroup} style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            disabled={processingKey === `${selectedVerification.id}:${item.type}:approve`}
                            onClick={() => processAction(selectedVerification, 'approve', item.type)}
                            className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                            style={{ '--button-bg': 'rgba(16, 185, 129, 0.15)', '--button-border': 'rgba(16,185,129,0.3)', '--button-color': '#34d399' }}
                          >
                            Aprovar tipo
                          </button>
                          <button
                            type="button"
                            disabled={processingKey === `${selectedVerification.id}:${item.type}:reject`}
                            onClick={() => processAction(selectedVerification, 'reject', item.type)}
                            className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                            style={{ '--button-bg': 'rgba(239, 68, 68, 0.12)', '--button-border': 'rgba(239,68,68,0.3)', '--button-color': '#f87171' }}
                          >
                            Rejeitar tipo
                          </button>
                        </div>
                      ) : item.reviewReason ? (
                        <p className={styles.proofNote}>Motivo: {item.reviewReason}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className={styles.buttonGroupEnd} style={{ marginTop: '2rem' }}>
              <button type="button" onClick={closeModal} className={`${styles.buttonBase} ${styles.buttonGhost}`}>
                Fechar
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
