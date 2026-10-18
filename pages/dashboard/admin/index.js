import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import nookies from 'nookies';
import {
  FiUsers,
  FiUserCheck,
  FiBriefcase,
  FiFileText,
  FiSend,
  FiCheckCircle,
  FiShield,
  FiInbox,
  FiBarChart2,
  FiZap,
  FiActivity,
  FiAlertTriangle,
  FiBell,
  FiPlus,
  FiSettings,
  FiTrendingUp,
} from 'react-icons/fi';
import DashboardShell, {
  Counter,
} from '../../../components/dashboard/DashboardShell';
import { useAuth } from '../../../context/AuthContext';
import { isAdminPublishedJob } from '../../../lib/adminJobManagement';
import { admin } from '../../../lib/firebaseAdmin';
import { auth } from '../../../lib/firebase';
import { redirectToLogin } from '../../../lib/loginRedirect';

const AdminSystemFlowChart = dynamic(
  () => import('../../../components/charts/AdminSystemFlowChart'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-3)',
        }}
      >
        A carregar gráfico...
      </div>
    ),
  },
);

const formatDate = (value, locale = 'pt-PT', options = {}) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString(locale, options);
};

const statusBadgeMap = {
  active: { label: 'Ativa', cls: 'badge-active' },
  closed: { label: 'Fechada', cls: 'badge-closed' },
  disabled: { label: 'Desativada', cls: 'badge-disabled' },
  default: { label: 'Desconhecido', cls: 'badge-disabled' },
};

function StatCard({
  icon: Icon,
  value,
  label,
  delta,
  deltaType,
  accent,
  accentShadow,
  iconColor = '#fff',
  href,
}) {
  const style = { '--accent': accent, '--accent-shadow': accentShadow };
  const inner = (
    <>
      <div
        className="stat-icon"
        style={{
          background: accent,
          color: iconColor,
          boxShadow: `0 8px 20px ${accentShadow}`,
        }}
      >
        <Icon />
      </div>
      <div className="stat-value">
        <Counter value={value} />
      </div>
      <div className="stat-label">{label}</div>
      {delta ? (
        <div className={`stat-delta ${deltaType || 'up'}`}>{delta}</div>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className="stat-card" style={style}>
      {inner}
    </Link>
  ) : (
    <div className="stat-card" style={style}>
      {inner}
    </div>
  );
}

function ActionCard({ href, label, icon: Icon, color, bg, border }) {
  return (
    <Link
      href={href}
      className="action-card"
      style={{
        '--accent-color': color,
        '--accent-bg': bg,
        '--accent-border': border,
      }}
    >
      <div className="action-card-icon">
        <Icon />
      </div>
      <div className="action-card-label">{label}</div>
    </Link>
  );
}

const ADMIN_QUICK_ACTIONS = [
  {
    href: '/dashboard/admin/jobs?source=admin',
    label: 'Gerir vagas do Admin',
    icon: FiBriefcase,
    color: 'var(--dash-info-text, #064bb5)',
    bg: 'rgba(6,75,181,0.1)',
    border: 'rgba(6,75,181,0.2)',
  },
  {
    href: '/dashboard/admin/users',
    label: 'Gerir utilizadores',
    icon: FiUsers,
    color: 'var(--dash-info-text, #064bb5)',
    bg: 'rgba(32,87,215,0.1)',
    border: 'rgba(32,87,215,0.18)',
  },
  {
    href: '/dashboard/admin/verificacoes',
    label: 'Verificações',
    icon: FiShield,
    color: 'var(--dash-success-text, #0f6b41)',
    bg: 'rgba(61,187,122,0.1)',
    border: 'rgba(61,187,122,0.2)',
  },
  {
    href: '/dashboard/admin/reports',
    label: 'Ver relatórios',
    icon: FiBarChart2,
    color: 'var(--dash-company-text, #5c6d00)',
    bg: 'rgba(217,255,47,0.12)',
    border: 'rgba(186,230,39,0.3)',
  },
  {
    href: '/dashboard/admin/blog',
    label: 'Publicar artigo',
    icon: FiFileText,
    color: 'var(--dash-danger-text, #b83d55)',
    bg: 'rgba(244,114,182,0.1)',
    border: 'rgba(244,114,182,0.2)',
  },
];

const ADMIN_INSIGHTS = [
  {
    title: 'Qualidade das vagas',
    content:
      'Revise descrições e requisitos para reduzir candidaturas desalinhadas.',
    category: 'GESTÃO',
  },
  {
    title: 'Crescimento saudável',
    content:
      'Acompanhe empresas activas e intervenha cedo quando a publicação abranda.',
    category: 'CRESCIMENTO',
  },
  {
    title: 'Tempo de resposta',
    content:
      'Mantenha feedback rápido para melhorar a confiança na plataforma.',
    category: 'EXPERIÊNCIA',
  },
];

function formatRelativeTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Agora';
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );
  if (elapsedMinutes < 1) return 'Agora';
  if (elapsedMinutes < 60) return `Há ${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Há ${elapsedHours} h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `Há ${elapsedDays} d`;
  return formatDate(value, 'pt-PT', { day: '2-digit', month: 'short' });
}

function activityIcon(type) {
  const normalizedType = String(type || '').toLowerCase();
  if (normalizedType.includes('job') || normalizedType.includes('vaga'))
    return FiBriefcase;
  if (
    normalizedType.includes('application') ||
    normalizedType.includes('candidatura')
  )
    return FiSend;
  if (
    normalizedType.includes('verification') ||
    normalizedType.includes('verifica')
  )
    return FiShield;
  return FiUserCheck;
}

export default function AdminDashboard({
  initialStats = null,
  adminJobs = [],
  recentActivities = [],
  monthlyRegistrations = [],
  monthlyRegistrationYear = new Date().getFullYear(),
}) {
  const { user } = useAuth();
  const [loading] = useState(!initialStats);
  const [stats] = useState(initialStats || {});
  const [error] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');

  const normalizedSearch = adminSearch.trim().toLocaleLowerCase('pt-PT');
  const visibleActivities = useMemo(
    () =>
      recentActivities.filter((activity) => {
        if (!normalizedSearch) return true;
        return `${activity.title || ''} ${activity.description || ''}`
          .toLocaleLowerCase('pt-PT')
          .includes(normalizedSearch);
      }),
    [normalizedSearch, recentActivities],
  );
  const visibleAdminJobs = useMemo(
    () =>
      adminJobs.filter((job) => {
        if (!normalizedSearch) return true;
        return `${job.titulo || ''} ${job.companyName || ''} ${job.status || ''}`
          .toLocaleLowerCase('pt-PT')
          .includes(normalizedSearch);
      }),
    [adminJobs, normalizedSearch],
  );
  const goalTarget = Math.max(
    400,
    (Math.floor((Number(stats.totalUsers) || 0) / 100) + 1) * 100,
  );
  const goalProgress = Math.min(
    100,
    Math.round(((Number(stats.totalUsers) || 0) / goalTarget) * 100),
  );

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('No authenticated user');
        return;
      }
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/verifications', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 304) return;
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        setVerifications(data.verifications || []);
      } else {
        console.error('Failed to fetch verifications:', await response.text());
      }
    } catch (fetchError) {
      console.error('Error fetching verifications:', fetchError);
    }
  };

  const today = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <Head>
        <title>Dashboard Admin - EmpregoSTP</title>
      </Head>

      <DashboardShell
        role="admin"
        active="overview"
        title="Visão geral"
        subtitle={`Bem-vindo, ${user?.displayName || 'Admin'} · ${today}`}
        profile={{
          name: user?.displayName || 'Administrador',
          role: 'Administrador',
          plan: 'ADMIN',
        }}
        navBadges={{
          jobs: stats.adminPublishedJobs || undefined,
          verificacoes: verifications.length || undefined,
        }}
        searchPlaceholder="Pesquisar utilizadores, vagas..."
        searchValue={adminSearch}
        onSearchChange={setAdminSearch}
        topbarActions={
          <div className="dash-topbar-actions">
            <Link
              href="/dashboard/admin/verificacoes"
              className="dash-icon-btn"
              aria-label="Abrir verificações pendentes"
              title="Verificações pendentes"
            >
              <FiBell />
              {verifications.length > 0 && <span className="dash-notif-dot" />}
            </Link>
            <Link
              href="/dashboard/admin/payment-settings"
              className="dash-icon-btn"
              aria-label="Abrir configurações"
              title="Configurações"
            >
              <FiSettings />
            </Link>
          </div>
        }
      >
        {loading ? (
          <div className="loading-state">
            <div className="spinner spinner-lg" />
            <p>A carregar painel...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div
              className="empty-state-icon"
              style={{ color: 'var(--danger)' }}
            >
              <FiAlertTriangle />
            </div>
            <p>{error}</p>
            <div style={{ marginTop: 16 }}>
              <Link href="/login" className="btn btn-primary">
                Voltar para o Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Dashboard · Admin</div>
                <h1 className="header-title">Painel de Controlo</h1>
                <p className="header-sub">
                  Visão geral da plataforma EmpregoSTP em tempo real.
                </p>
              </div>
              <div className="header-actions">
                <Link
                  href="/dashboard/admin/jobs/create"
                  className="btn btn-lime"
                >
                  <FiPlus /> Nova vaga
                </Link>
                <Link href="/dashboard/admin/users" className="btn btn-primary">
                  <FiUserCheck /> Novo utilizador
                </Link>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard
                icon={FiUsers}
                value={stats.totalUsers || 0}
                label="Total de utilizadores"
                delta="Contas registadas"
                accent="linear-gradient(135deg,#2057d7,#4f8ef7)"
                accentShadow="rgba(32,87,215,0.28)"
                href="/dashboard/admin/users"
              />
              <StatCard
                icon={FiBriefcase}
                value={stats.activeJobs || 0}
                label="Vagas activas"
                delta="Publicações disponíveis"
                accent="linear-gradient(135deg,#5fb8f5,#7dceff)"
                accentShadow="rgba(95,184,245,0.28)"
                href="/dashboard/admin/jobs"
              />
              <StatCard
                icon={FiUserCheck}
                value={stats.totalEmpresas || 0}
                label="Empresas registadas"
                delta="Contas de empresa"
                deltaType="warn"
                accent="linear-gradient(135deg,#d9ff2f,#bae619)"
                iconColor="#162a55"
                accentShadow="rgba(186,230,39,0.28)"
                href="/dashboard/admin/users"
              />
              <StatCard
                icon={FiSend}
                value={stats.totalApplications || 0}
                label="Candidaturas enviadas"
                delta="Total acumulado"
                accent="linear-gradient(135deg,#3dbb7a,#22c55e)"
                accentShadow="rgba(61,187,122,0.28)"
                href="/dashboard/admin/jobs"
              />
            </div>

            <div className="action-cards admin-quick-actions">
              {ADMIN_QUICK_ACTIONS.map((action) => (
                <ActionCard
                  key={action.href}
                  {...action}
                  label={
                    action.href === '/dashboard/admin/verificacoes' &&
                    verifications.length > 0
                      ? `${action.label} (${verifications.length})`
                      : action.label
                  }
                />
              ))}
            </div>

            <div className="admin-design-grid">
              <section className="panel admin-activity-panel">
                <div className="panel-title">
                  Actividade recente
                  <Link
                    href="/dashboard/admin/auditoria"
                    className="panel-link"
                  >
                    Ver auditoria
                  </Link>
                </div>
                <div className="admin-activity-list">
                  {visibleActivities.length === 0 ? (
                    <div className="admin-design-empty">
                      {normalizedSearch
                        ? 'Nenhuma actividade corresponde à pesquisa.'
                        : 'Ainda não existe actividade recente.'}
                    </div>
                  ) : (
                    visibleActivities.slice(0, 5).map((activity) => {
                      const ActivityIcon = activityIcon(activity.type);
                      return (
                        <div className="admin-activity-row" key={activity.id}>
                          <span
                            className={`admin-activity-icon tone-${activity.tone || 'blue'}`}
                          >
                            <ActivityIcon />
                          </span>
                          <span className="admin-activity-copy">
                            <strong>{activity.title}</strong>
                            <small>{activity.description}</small>
                          </span>
                          <time dateTime={activity.createdAt || undefined}>
                            {formatRelativeTime(activity.createdAt)}
                          </time>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <div className="admin-design-side">
                <section className="panel admin-goal-panel">
                  <div className="panel-title">
                    Meta mensal
                    <span className="panel-badge">
                      <FiTrendingUp /> {goalProgress}%
                    </span>
                  </div>
                  <div className="admin-goal-value">
                    <strong>{stats.totalUsers || 0}</strong>
                    <span>/ {goalTarget} utilizadores activos</span>
                  </div>
                  <div
                    className="admin-goal-track"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax={goalTarget}
                    aria-valuenow={stats.totalUsers || 0}
                    aria-label="Progresso da meta mensal"
                  >
                    <span style={{ width: `${goalProgress}%` }} />
                  </div>
                  <p className="admin-goal-status">
                    <FiCheckCircle />
                    {goalProgress >= 100
                      ? 'Meta alcançada'
                      : goalProgress >= 70
                        ? 'No bom caminho'
                        : 'Acompanhar evolução'}
                  </p>
                </section>

                <section className="panel admin-insights-panel">
                  <div className="panel-title">
                    Insights
                    <span className="panel-badge">
                      <FiZap /> Advisor
                    </span>
                  </div>
                  {ADMIN_INSIGHTS.map((tip) => (
                    <div key={tip.title} className="advisor-item">
                      <div className="advisor-cat">{tip.category}</div>
                      <div className="advisor-title">{tip.title}</div>
                      <div className="advisor-text">{tip.content}</div>
                    </div>
                  ))}
                </section>
              </div>
            </div>

            <section className="panel admin-distribution-panel">
              <div className="panel-title">
                Distribuição da plataforma
                <span className="panel-badge">
                  <FiActivity /> {monthlyRegistrationYear}
                </span>
              </div>
              <p className="admin-panel-sub">
                Novos utilizadores registados por mês
              </p>
              <div className="admin-distribution-chart">
                <AdminSystemFlowChart data={monthlyRegistrations} />
              </div>
            </section>

            <div className="dash-section admin-jobs-hub">
              <div className="dash-flex-between admin-table-heading">
                <div>
                  <h2 className="dash-section-title">
                    Vagas publicadas pelo Admin
                  </h2>
                  <p className="admin-panel-sub">
                    Gerir as publicações administrativas e as candidaturas
                    recebidas.
                  </p>
                </div>
                <div className="header-actions">
                  <Link
                    href="/dashboard/admin/jobs/create"
                    className="btn btn-lime btn-sm"
                  >
                    <FiPlus /> Nova vaga
                  </Link>
                  <Link
                    href="/dashboard/admin/jobs?source=admin"
                    className="btn btn-primary btn-sm"
                  >
                    <FiBriefcase /> Gerir todas
                  </Link>
                </div>
              </div>

              <div
                className="admin-jobs-summary"
                aria-label="Resumo das vagas publicadas pelo Admin"
              >
                <div>
                  <strong>
                    <Counter value={stats.adminPublishedJobs || 0} />
                  </strong>
                  <span>Vagas publicadas</span>
                </div>
                <div>
                  <strong>
                    <Counter value={stats.activeAdminJobs || 0} />
                  </strong>
                  <span>Vagas ativas</span>
                </div>
                <div>
                  <strong>
                    <Counter value={stats.adminJobApplications || 0} />
                  </strong>
                  <span>Candidaturas recebidas</span>
                </div>
              </div>

              {visibleAdminJobs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <FiInbox />
                  </div>
                  <p>
                    {normalizedSearch
                      ? 'Nenhuma vaga do Admin corresponde à pesquisa.'
                      : 'O Admin ainda não publicou vagas.'}
                  </p>
                </div>
              ) : (
                <div className="table-shell">
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label="Vagas publicadas pelo Admin"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Título</th>
                          <th>Empresa</th>
                          <th>Estado</th>
                          <th>Candidaturas</th>
                          <th>Data</th>
                          <th className="td-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAdminJobs.map((job) => {
                          const badge =
                            statusBadgeMap[job.status] ||
                            statusBadgeMap.default;
                          return (
                            <tr key={job.id}>
                              <td className="td-strong">{job.titulo}</td>
                              <td className="td-muted">
                                {job.companyName || 'N/A'}
                              </td>
                              <td>
                                <span className={`badge ${badge.cls}`}>
                                  <span className="badge-dot" />
                                  {badge.label}
                                </span>
                              </td>
                              <td>
                                <Link
                                  href={`/dashboard/admin/jobs/${job.id}#candidaturas`}
                                  className="panel-link"
                                >
                                  {job.applicationCount || 0}
                                </Link>
                              </td>
                              <td className="td-muted">
                                {job.createdAt
                                  ? formatDate(job.createdAt, 'pt-PT', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : 'N/A'}
                              </td>
                              <td className="td-right">
                                <div
                                  className="header-actions"
                                  style={{ justifyContent: 'flex-end' }}
                                >
                                  <Link
                                    href={`/dashboard/admin/jobs/${job.id}#candidaturas`}
                                    className="btn btn-primary btn-sm"
                                  >
                                    Candidaturas
                                  </Link>
                                  <Link
                                    href={`/dashboard/admin/jobs/${job.id}/edit`}
                                    className="btn btn-ghost btn-sm"
                                  >
                                    Editar
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DashboardShell>
    </>
  );
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

    const [
      usersSnapshot,
      candidatosSnapshot,
      empresasSnapshot,
      jobsSnapshot,
      applicationsSnapshot,
      postsSnapshot,
      resourcesSnapshot,
      newsSnapshot,
    ] = await Promise.all([
      admin.firestore().collection('users').get(),
      // Estas cinco só alimentam totais: `count()` devolve o mesmo número sem
      // transferir os documentos.
      admin
        .firestore()
        .collection('users')
        .where('userType', '==', 'candidato')
        .count()
        .get(),
      admin
        .firestore()
        .collection('users')
        .where('userType', '==', 'empresa')
        .count()
        .get(),
      admin.firestore().collection('jobs').get(),
      admin.firestore().collection('applications').get(),
      admin.firestore().collection('posts').count().get(),
      admin.firestore().collection('resources_templates').count().get(),
      admin.firestore().collection('news').count().get(),
    ]);

    const serializeTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp.toDate) return timestamp.toDate().toISOString();
      if (timestamp.toMillis)
        return new Date(timestamp.toMillis()).toISOString();
      if (typeof timestamp === 'string') return timestamp;
      if (timestamp instanceof Date) return timestamp.toISOString();
      return null;
    };

    const serializeJob = (job) => ({
      id: job.id,
      titulo: job.titulo || '',
      status: job.status || '',
      companyId: job.companyId || null,
      createdAt: serializeTimestamp(job.createdAt),
      lastViewedAt: serializeTimestamp(job.lastViewedAt),
      updatedAt: serializeTimestamp(job.updatedAt),
      ...Object.keys(job).reduce((acc, key) => {
        if (
          key !== 'id' &&
          key !== 'createdAt' &&
          key !== 'lastViewedAt' &&
          key !== 'updatedAt'
        ) {
          const value = job[key];
          acc[key] =
            value && (value.toDate || value.toMillis)
              ? serializeTimestamp(value)
              : value;
        }
        return acc;
      }, {}),
    });

    const usersData = usersSnapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name:
          data.name ||
          data.fullName ||
          data.companyName ||
          data.email ||
          'Utilizador',
        userType: data.userType || data.role || 'utilizador',
        createdAt: serializeTimestamp(data.createdAt),
      };
    });
    const usersById = new Map(usersData.map((entry) => [entry.id, entry]));

    const jobsData = jobsSnapshot.docs.map((doc) =>
      serializeJob({ id: doc.id, ...doc.data() }),
    );
    const applicationsData = applicationsSnapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        jobId: data.jobId || '',
        candidateName:
          data.candidateName || data.userName || data.fullName || 'Candidato',
        jobTitle: data.jobTitle || data.titulo || 'Vaga',
        createdAt: serializeTimestamp(data.createdAt || data.appliedAt),
      };
    });
    const activeJobs = jobsData.filter((job) => job.status === 'active').length;
    const closedJobs = jobsData.filter((job) => job.status === 'closed').length;
    const disabledJobs = jobsData.filter(
      (job) => job.status === 'disabled',
    ).length;

    const sortedJobs = [...jobsData].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const applicationsByJob = applicationsData.reduce((counts, application) => {
      if (application.jobId) {
        counts[application.jobId] = (counts[application.jobId] || 0) + 1;
      }
      return counts;
    }, {});
    const adminPublishedJobs = sortedJobs.filter((job) =>
      isAdminPublishedJob(job),
    );
    const adminJobsWithCompanyNames = adminPublishedJobs
      .slice(0, 6)
      .map((job) => ({
        ...job,
        applicationCount: applicationsByJob[job.id] || 0,
        companyName:
          job.companyName ||
          job.empresaNome ||
          usersById.get(job.companyId)?.name ||
          'Empresa',
      }));

    const recentActivities = [
      ...usersData.map((entry) => ({
        id: `user-${entry.id}`,
        type: 'user',
        tone: 'blue',
        title: `${entry.name} criou uma conta`,
        description:
          entry.userType === 'empresa'
            ? 'Nova empresa registada'
            : entry.userType === 'candidato'
              ? 'Novo candidato registado'
              : 'Novo utilizador registado',
        createdAt: entry.createdAt,
      })),
      ...jobsData.map((job) => ({
        id: `job-${job.id}`,
        type: 'job',
        tone: 'sky',
        title: `${
          job.companyName ||
          job.empresaNome ||
          usersById.get(job.companyId)?.name ||
          'Uma empresa'
        } publicou uma vaga`,
        description: job.titulo || 'Nova vaga',
        createdAt: job.createdAt,
      })),
      ...applicationsData.map((application) => ({
        id: `application-${application.id}`,
        type: 'application',
        tone: 'green',
        title: `${application.candidateName} enviou uma candidatura`,
        description: application.jobTitle,
        createdAt: application.createdAt,
      })),
    ]
      .filter((activity) => activity.createdAt)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 8);

    const registrationDates = usersData
      .map((entry) => (entry.createdAt ? new Date(entry.createdAt) : null))
      .filter((date) => date && !Number.isNaN(date.getTime()));
    const monthlyRegistrationYear =
      registrationDates.length > 0
        ? Math.max(...registrationDates.map((date) => date.getFullYear()))
        : new Date().getFullYear();
    const monthLabels = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    const monthlyRegistrations = monthLabels.map((name, month) => ({
      name,
      value: registrationDates.filter(
        (date) =>
          date.getFullYear() === monthlyRegistrationYear &&
          date.getMonth() === month,
      ).length,
    }));

    return {
      props: {
        initialStats: {
          totalUsers: usersSnapshot.size,
          totalCandidatos: candidatosSnapshot.data().count,
          totalEmpresas: empresasSnapshot.data().count,
          totalJobs: jobsSnapshot.size,
          activeJobs,
          closedJobs,
          disabledJobs,
          adminPublishedJobs: adminPublishedJobs.length,
          activeAdminJobs: adminPublishedJobs.filter(
            (job) => job.status === 'active',
          ).length,
          adminJobApplications: adminPublishedJobs.reduce(
            (total, job) => total + (applicationsByJob[job.id] || 0),
            0,
          ),
          totalApplications: applicationsSnapshot.size,
          totalPosts: postsSnapshot.data().count,
          totalResources: resourcesSnapshot.data().count,
          totalNews: newsSnapshot.data().count,
        },
        adminJobs: adminJobsWithCompanyNames,
        recentActivities,
        monthlyRegistrations,
        monthlyRegistrationYear,
      },
    };
  } catch (serverError) {
    console.error('Erro no getServerSideProps:', serverError);
    return redirectToLogin(context);
  }
}
