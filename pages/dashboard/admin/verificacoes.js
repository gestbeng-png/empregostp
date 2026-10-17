import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import { VERIFICATION_TYPE_CONFIG } from '../../../lib/candidateVerification';
import VerificationReviewModal, {
  getOrderedItems,
  StatusBadge,
} from '../../../components/admin/VerificationReviewModal';
import styles from '../../../styles/AdminPanel.module.css';

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
        throw new Error(
          data.error || data.message || 'Erro ao carregar verificações',
        );
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
      if (!res.ok)
        throw new Error(data.error || data.message || 'Erro ao processar');

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
          prev.map((item) =>
            item.id === verification.id ? nextVerification : item,
          ),
        );
        setSelectedVerification(nextVerification);
      }

      const typeLabel = verificationType
        ? VERIFICATION_TYPE_CONFIG[verificationType]?.label || verificationType
        : 'pedido';

      const outcome = {
        approve: 'aprovado com sucesso',
        reject: 'rejeitado',
        revoke: 'desativado',
      }[action];
      setMessage({
        text: verificationType
          ? `${typeLabel} de ${verification.candidateName} ${outcome}.`
          : `Verificação de ${verification.candidateName} ${outcome}.`,
        ok: action !== 'reject',
      });

      setReviewReason('');
    } catch (err) {
      setMessage({ text: err.message, ok: false });
    } finally {
      setProcessingKey('');
    }
  }

  const stats = useMemo(
    () => ({
      pending: verifications.filter((item) => item.summary?.pendingCount > 0)
        .length,
      verified: verifications.filter((item) => item.summary?.publicVerified)
        .length,
      total: verifications.length,
    }),
    [verifications],
  );

  const closeModal = () => {
    setSelectedVerification(null);
    setReviewReason('');
  };

  const requestedTypeCount = (verification) =>
    getOrderedItems(verification).length;

  return (
    <>
      <Head>
        <title>Verificações | Admin EmpregoSTP</title>
      </Head>

      <div className={`${styles.page} ${styles.pageNarrow}`}>
        <div className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonGhost} ${styles.buttonSmall}`}
            >
              ← Voltar ao Dashboard
            </Link>
            <h1 className={styles.headerTitle}>Verificações</h1>
            <p className={styles.headerSubtitle}>
              Painel por tipo de verificação, com checklist e evidências por
              candidato.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={fetchVerifications}
              disabled={loading}
              className={`${styles.buttonBase} ${styles.buttonGhost}`}
            >
              Atualizar
            </button>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.gridStats}>
            <StatCard
              title="Com itens pendentes"
              value={stats.pending}
              color="#f59e0b"
            />
            <StatCard
              title="Perfis públicos verificados"
              value={stats.verified}
              color="#0b6644"
            />
            <StatCard
              title="Total carregados"
              value={stats.total}
              color="#4a5568"
            />
          </div>
        </section>

        {message.text ? (
          <div
            role="status"
            aria-live="polite"
            className={`${styles.alert} ${message.ok ? styles.alertSuccess : styles.alertError}`}
          >
            {message.text}
          </div>
        ) : null}

        {error ? (
          <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
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
                <p className={styles.emptyText}>
                  Nenhuma verificação encontrada.
                </p>
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
                      <th className={styles.tableHeadCell}>Estado</th>
                      <th
                        className={`${styles.tableHeadCell} ${styles.alignRight}`}
                      >
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((verification) => {
                      return (
                        <tr key={verification.id} className={styles.tableRow}>
                          <td className={styles.tableCell}>
                            <Link
                              href={`/dashboard/admin/users/${verification.uid}`}
                              className={styles.proofLink}
                            >
                              {verification.candidateName}
                            </Link>
                          </td>
                          <td
                            className={`${styles.tableCell} ${styles.tableCellSoft}`}
                          >
                            {verification.candidateEmail}
                          </td>
                          <td
                            className={`${styles.tableCell} ${styles.tableCellSoft} ${styles.nowrap}`}
                          >
                            {formatDate(
                              verification.updatedAt ||
                                verification.submittedAt,
                            )}
                          </td>
                          <td className={styles.tableCell}>
                            <span
                              className={`${styles.badge} ${styles.badgeSmall}`}
                              style={{
                                // Era branco-acinzentado sobre branco (1.23:1).
                                '--badge-bg': 'rgba(21, 37, 79, 0.06)',
                                '--badge-color': '#2d3f5c',
                                '--badge-border':
                                  '1px solid rgba(21, 37, 79, 0.12)',
                              }}
                            >
                              {requestedTypeCount(verification)} tipo(s)
                            </span>
                          </td>
                          <td
                            className={`${styles.tableCell} ${styles.tableCellSoft}`}
                          >
                            {verification.summary
                              ? `${verification.summary.approvedCount || 0} aprovados • ${verification.summary.pendingCount || 0} pendentes`
                              : '—'}
                          </td>
                          <td className={styles.tableCell}>
                            <StatusBadge status={verification.status} />
                          </td>
                          <td
                            className={`${styles.tableCell} ${styles.alignRight}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedVerification(verification)
                              }
                              className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
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
      </div>

      {selectedVerification ? (
        <VerificationReviewModal
          selectedVerification={selectedVerification}
          closeModal={closeModal}
          reviewReason={reviewReason}
          setReviewReason={setReviewReason}
          processAction={processAction}
          processingKey={processingKey}
        />
      ) : null}
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
