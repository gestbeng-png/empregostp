import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import nookies from 'nookies';
import { isAdminPublishedJob } from '../../../lib/adminJobManagement';
import { admin } from '../../../lib/firebaseAdmin';
import styles from '../../../styles/AdminPanel.module.css';
import { redirectToLogin } from '../../../lib/loginRedirect';

export default function AdminJobs({ jobs = [], jobApprovalRequired = false }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [moderatingId, setModeratingId] = useState('');
  const [moderationFeedback, setModerationFeedback] = useState(null);
  const [approvalRequired, setApprovalRequired] = useState(
    Boolean(jobApprovalRequired),
  );
  const [savingApproval, setSavingApproval] = useState(false);

  // A fila de revisão existia (aprovar/rejeitar abaixo), mas não havia forma de
  // a ligar: o toggle `settings/moderation` só se mudava na base de dados.
  const updateApprovalRequired = async (next) => {
    if (savingApproval) return;
    setSavingApproval(true);
    setModerationFeedback(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const response = await fetch('/api/admin/moderation-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobApprovalRequired: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.message || 'Não foi possível guardar a definição.',
        );
      }
      setApprovalRequired(data.jobApprovalRequired === true);
      setModerationFeedback({
        ok: true,
        text: data.jobApprovalRequired
          ? 'Revisão ativada: as novas vagas das empresas ficam em moderação até serem aprovadas.'
          : 'Revisão desativada: as novas vagas das empresas são publicadas de imediato.',
      });
    } catch (error) {
      setModerationFeedback({ ok: false, text: error.message });
    } finally {
      setSavingApproval(false);
    }
  };

  // O endpoint de moderação existia sem qualquer chamador na interface: as
  // vagas ficavam em `pending_review` sem forma de as aprovar, e a única saída
  // era o PUT genérico, que publicava sem registo nem notificação.
  const moderateJob = async (job, action) => {
    if (moderatingId) return;

    let reason = '';
    if (action === 'reject') {
      reason =
        window.prompt('Motivo da rejeição (visível para a empresa):') || '';
      if (!reason.trim()) return;
    }

    setModeratingId(job.id);
    setModerationFeedback(null);

    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const response = await fetch(`/api/admin/jobs/${job.id}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || 'Não foi possível concluir.',
        );
      }

      setModerationFeedback({
        ok: true,
        text:
          action === 'approve'
            ? `"${job.titulo}" foi aprovada e publicada.`
            : `"${job.titulo}" foi rejeitada.`,
      });
      router.replace(router.asPath, undefined, { scroll: false });
    } catch (error) {
      setModerationFeedback({ ok: false, text: error.message });
    } finally {
      setModeratingId('');
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    const requestedSource = router.query.source;
    setSourceFilter(
      requestedSource === 'admin' || requestedSource === 'company'
        ? requestedSource
        : 'all',
    );
  }, [router.isReady, router.query.source]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !query ||
        job.titulo?.toLowerCase().includes(query) ||
        job.companyName?.toLowerCase().includes(query) ||
        job.localizacao?.toLowerCase().includes(query);

      const matchesStatus =
        filterStatus === 'all' || job.status === filterStatus;
      const publishedByAdmin = isAdminPublishedJob(job);
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'admin' && publishedByAdmin) ||
        (sourceFilter === 'company' && !publishedByAdmin);

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [jobs, searchTerm, filterStatus, sourceFilter]);

  const handleSourceChange = (event) => {
    const source = event.target.value;
    setSourceFilter(source);
    const nextQuery = { ...router.query };
    if (source === 'all') delete nextQuery.source;
    else nextQuery.source = source;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  };

  const stats = {
    total: jobs.length,
    active: jobs.filter((job) => job.status === 'active').length,
    closed: jobs.filter((job) => job.status === 'closed').length,
    disabled: jobs.filter((job) => job.status === 'disabled').length,
    pendingReview: jobs.filter((job) => job.status === 'pending_review').length,
  };

  return (
    <>
      <Head>
        <title>Gerir vagas - Admin</title>
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
            <h1 className={styles.headerTitle}>Gerir vagas</h1>
            <p className={styles.headerSubtitle}>
              {filteredJobs.length} de {jobs.length} vagas listadas.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link
              href="/dashboard/admin/jobs/create"
              className={`${styles.linkButton} ${styles.buttonSuccess}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nova vaga
            </Link>
          </div>
        </section>

        <section className={`${styles.section} ${styles.gridStats}`}>
          <StatCard
            title="Total"
            value={stats.total}
            active={filterStatus === 'all'}
            accent="var(--dash-info-text, #064bb5)"
            onClick={() => setFilterStatus('all')}
          />
          <StatCard
            title="Em moderação"
            value={stats.pendingReview}
            active={filterStatus === 'pending_review'}
            accent="#9a6206"
            onClick={() => setFilterStatus('pending_review')}
          />
          <StatCard
            title="Ativas"
            value={stats.active}
            active={filterStatus === 'active'}
            accent="var(--dash-company-text, #5c6d00)"
            onClick={() => setFilterStatus('active')}
          />
          <StatCard
            title="Fechadas"
            value={stats.closed}
            active={filterStatus === 'closed'}
            accent="var(--dash-danger-text, #b83d55)"
            onClick={() => setFilterStatus('closed')}
          />
          <StatCard
            title="Desativadas"
            value={stats.disabled}
            active={filterStatus === 'disabled'}
            accent="var(--admin-muted)"
            onClick={() => setFilterStatus('disabled')}
          />
        </section>

        <section
          className={`${styles.surface} ${styles.panel} ${styles.section}`}
          aria-labelledby="admin-jobs-approval-title"
        >
          <h2 id="admin-jobs-approval-title" className={styles.chartTitle}>
            Revisão antes de publicar
          </h2>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              role="switch"
              checked={approvalRequired}
              aria-checked={approvalRequired}
              disabled={savingApproval}
              onChange={(event) => updateApprovalRequired(event.target.checked)}
            />
            {savingApproval
              ? 'A guardar…'
              : approvalRequired
                ? 'Ativa — as vagas novas das empresas aguardam aprovação'
                : 'Desativada — as vagas novas das empresas são publicadas de imediato'}
          </label>
        </section>

        {moderationFeedback ? (
          <div
            role="status"
            aria-live="polite"
            className={`${styles.alert} ${
              moderationFeedback.ok ? styles.alertSuccess : styles.alertError
            }`}
          >
            {moderationFeedback.text}
          </div>
        ) : null}

        <section
          className={`${styles.surface} ${styles.panel} ${styles.section}`}
        >
          <div className={styles.inlineControls}>
            <div style={{ flex: '1 1 320px' }}>
              <label className={styles.chartTitle} htmlFor="admin-jobs-search">
                Pesquisar
              </label>
              <input
                id="admin-jobs-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Título, empresa ou localização..."
                className={styles.inputControl}
              />
            </div>
            <div style={{ flex: '0 1 260px' }}>
              <label className={styles.chartTitle} htmlFor="admin-jobs-source">
                Origem da publicação
              </label>
              <select
                id="admin-jobs-source"
                value={sourceFilter}
                onChange={handleSourceChange}
                className={styles.selectControl}
              >
                <option value="all">Todas as vagas</option>
                <option value="admin">Publicadas pelo Admin</option>
                <option value="company">Publicadas pelas empresas</option>
              </select>
            </div>
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`${styles.buttonBase} ${styles.buttonGhost}`}
              >
                Limpar pesquisa
              </button>
            ) : null}
          </div>
        </section>

        {filteredJobs.length === 0 ? (
          <section className={styles.emptyState}>
            <p className={styles.emptyText}>
              Nenhuma vaga encontrada para os filtros atuais.
            </p>
          </section>
        ) : (
          <section className={styles.tableShell}>
            <div className={`${styles.tableWrap} ${styles.tableWrapMin}`}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableHeadRow}>
                    <th className={styles.tableHeadCell}>Título</th>
                    <th className={styles.tableHeadCell}>Empresa</th>
                    <th className={styles.tableHeadCell}>Origem</th>
                    <th className={styles.tableHeadCell}>Localização</th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Estado
                    </th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Candidaturas
                    </th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                    >
                      Views
                    </th>
                    <th className={styles.tableHeadCell}>Data</th>
                    <th
                      className={`${styles.tableHeadCell} ${styles.alignRight}`}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr className={styles.tableRow} key={job.id}>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellStrong}`}
                      >
                        {job.titulo}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellMuted}`}
                      >
                        {job.companyName || 'N/A'}
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles.countBadge}>
                          {isAdminPublishedJob(job) ? 'Admin' : 'Empresa'}
                        </span>
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellSoft}`}
                      >
                        {job.localizacao || 'N/A'}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignCenter}`}
                      >
                        <StatusBadge status={job.status} />
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignCenter} ${styles.tableCellStrong}`}
                      >
                        <Link
                          href={`/dashboard/admin/jobs/${job.id}#candidaturas`}
                          className={styles.proofLink}
                        >
                          {job.applicationCount || 0}
                        </Link>
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignCenter} ${styles.tableCellStrong} ${styles.tableMetric}`}
                      >
                        {job.views || 0}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.tableCellSoft} ${styles.nowrap}`}
                      >
                        {formatDate(job.createdAt)}
                      </td>
                      <td
                        className={`${styles.tableCell} ${styles.alignRight}`}
                      >
                        <div className={styles.buttonGroup}>
                          {job.status === 'pending_review' ? (
                            <>
                              <button
                                type="button"
                                disabled={moderatingId === job.id}
                                onClick={() => moderateJob(job, 'approve')}
                                className={`${styles.buttonBase} ${styles.buttonSuccess} ${styles.buttonSmall}`}
                              >
                                {moderatingId === job.id
                                  ? 'A processar…'
                                  : 'Aprovar'}
                              </button>
                              <button
                                type="button"
                                disabled={moderatingId === job.id}
                                onClick={() => moderateJob(job, 'reject')}
                                className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
                              >
                                Rejeitar
                              </button>
                            </>
                          ) : null}
                          <Link
                            href={`/dashboard/admin/jobs/${job.id}`}
                            className={`${styles.linkButton} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/dashboard/admin/jobs/${job.id}/edit`}
                            className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
                            style={{
                              '--button-bg': 'rgba(95, 184, 245, 0.14)',
                              '--button-border': 'rgba(95, 184, 245, 0.28)',
                              '--button-color': 'var(--admin-blue)',
                            }}
                          >
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function StatCard({ title, value, active, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${styles.statCard} ${active ? styles.statCardActive : ''}`}
      style={{
        '--accent-color': accent,
      }}
    >
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{title}</p>
    </button>
  );
}

function StatusBadge({ status }) {
  const palette = {
    active: {
      label: 'Ativa',
      style: {
        '--badge-bg': 'rgba(217, 255, 47, 0.22)',
        '--badge-color': 'var(--dash-company-text, #5c6d00)',
        '--badge-border': '1px solid rgba(217, 255, 47, 0.3)',
      },
    },
    closed: {
      label: 'Fechada',
      style: {
        '--badge-bg': 'rgba(239, 68, 68, 0.12)',
        '--badge-color': 'var(--dash-danger-text, #c62828)',
        '--badge-border': '1px solid rgba(239, 68, 68, 0.22)',
      },
    },
    disabled: {
      label: 'Desativada',
      style: {
        '--badge-bg': 'rgba(123, 141, 168, 0.12)',
        '--badge-color': 'var(--admin-muted)',
        '--badge-border': '1px solid rgba(123, 141, 168, 0.18)',
      },
    },
    pending_review: {
      label: 'Em moderação',
      style: {
        '--badge-bg': 'rgba(245, 158, 11, 0.16)',
        '--badge-color': '#9a6206',
        '--badge-border': '1px solid rgba(245, 158, 11, 0.3)',
      },
    },
    rejected: {
      label: 'Rejeitada',
      style: {
        '--badge-bg': 'rgba(239, 68, 68, 0.12)',
        '--badge-color': 'var(--dash-danger-text, #c62828)',
        '--badge-border': '1px solid rgba(239, 68, 68, 0.22)',
      },
    },
  };

  const current = palette[status] || {
    label: 'Desconhecido',
    style: {
      '--badge-bg': 'rgba(123, 141, 168, 0.12)',
      '--badge-color': 'var(--admin-muted)',
      '--badge-border': '1px solid rgba(123, 141, 168, 0.18)',
    },
  };

  return (
    <span
      className={`${styles.badge} ${styles.badgeSmall}`}
      style={current.style}
    >
      {current.label}
    </span>
  );
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return redirectToLogin(context);
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return redirectToLogin(context);
    }

    const userData = userDoc.data();

    if (userData.userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    const [jobsSnapshot, applicationsSnapshot, moderationSettings] =
      await Promise.all([
        admin.firestore().collection('jobs').orderBy('createdAt', 'desc').get(),
        admin.firestore().collection('applications').get(),
        admin.firestore().collection('settings').doc('moderation').get(),
      ]);
    const applicationsByJob = {};
    applicationsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.jobId) {
        applicationsByJob[data.jobId] =
          (applicationsByJob[data.jobId] || 0) + 1;
      }
    });

    const companyIds = [
      ...new Set(
        jobsSnapshot.docs.map((doc) => doc.data().companyId).filter(Boolean),
      ),
    ];
    const companiesMap = {};

    if (companyIds.length > 0) {
      const batches = [];
      for (let index = 0; index < companyIds.length; index += 10) {
        batches.push(companyIds.slice(index, index + 10));
      }

      const companySnapshots = await Promise.all(
        batches.map((batch) =>
          admin
            .firestore()
            .collection('users')
            .where(admin.firestore.FieldPath.documentId(), 'in', batch)
            .get(),
        ),
      );

      companySnapshots.forEach((companiesSnapshot) => {
        companiesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          companiesMap[doc.id] = data.name || data.fullName || 'Empresa';
        });
      });
    }

    const jobs = jobsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        titulo: data.titulo || 'Sem título',
        descricao: data.descricao || '',
        localizacao: data.localizacao || data.location || 'Não especificado',
        tipoContrato: data.tipoContrato || 'Não especificado',
        salarioDe: data.salarioDe || '',
        salarioAte: data.salarioAte || '',
        status: data.status || 'active',
        companyId: data.companyId || '',
        companySource: data.companySource || '',
        createdBy: data.createdBy || '',
        createdByRole: data.createdByRole || '',
        isExternalCompany: Boolean(data.isExternalCompany),
        companyName:
          companiesMap[data.companyId] ||
          data.companyName ||
          data.empresaNome ||
          'N/A',
        applicationCount: applicationsByJob[doc.id] || 0,
        views: data.views || 0,
        createdAt:
          typeof data.createdAt === 'string'
            ? data.createdAt
            : data.createdAt?.toDate?.()?.toISOString() ||
              new Date().toISOString(),
      };
    });

    return {
      props: {
        jobs,
        jobApprovalRequired:
          moderationSettings.exists &&
          moderationSettings.data()?.jobApprovalRequired === true,
      },
    };
  } catch (error) {
    console.error('Erro no getServerSideProps de admin/jobs:', error);
    return redirectToLogin(context);
  }
}
