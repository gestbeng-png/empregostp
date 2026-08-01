import Link from 'next/link';
import Head from 'next/head';
import nookies from 'nookies';
import { admin } from '../../../lib/firebaseAdmin';
import styles from '../../../styles/AdminPanel.module.css';
import { redirectToLogin } from '../../../lib/loginRedirect';

const safePercent = (value, total) => {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (Number(value || 0) / Number(total)) * 100));
};

function ReportCard({ title, value, color, icon }) {
  return (
    <div className={styles.reportCard} style={{ '--accent-color': color }}>
      <div className={styles.reportCardHead}>
        <h3 className={styles.reportCardTitle}>{title}</h3>
        <div className={styles.reportCardIcon}>{icon}</div>
      </div>
      <p className={styles.reportCardValue}>{value}</p>
    </div>
  );
}

const getActivityColor = (type) => {
  switch (type) {
    case 'user_created':
      return '#3b82f6';
    case 'job_created':
      return '#10b981';
    case 'job_updated':
      return '#f59e0b';
    case 'application_created':
      return '#8b5cf6';
    default:
      return '#64748b';
  }
};

const getActivityIcon = (type) => {
  switch (type) {
    case 'user_created':
      return (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case 'job_created':
      return (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'job_updated':
      return (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'application_created':
      return (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

export default function AdminReports({ reports = {} }) {
  const userTotal = reports.users?.total || 0;
  const jobTotal = reports.jobs?.total || 0;
  const activities = reports.activities || [];

  return (
    <>
      <Head>
        <title>Relatórios - Admin Dashboard</title>
      </Head>

      <div className={`${styles.page} ${styles.pageNarrow}`}>
        <div className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
              style={{ '--button-bg': 'rgba(255, 255, 255, 0.05)', '--button-border': 'rgba(255, 255, 255, 0.1)', '--button-color': '#93c5fd' }}
            >
              ← Voltar ao Dashboard
            </Link>
            <h1 className={`${styles.headerTitle} ${styles.headerTitleSmall}`}>Relatórios</h1>
            <p className={styles.headerSubtitle}>Visão consolidada do sistema com distribuição de utilizadores, vagas e atividade recente.</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Relatório de utilizadores</h2>
          <div className={styles.gridStats}>
            <ReportCard
              title="Total de utilizadores"
              value={userTotal}
              color="#3b82f6"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />
            <ReportCard
              title="Candidatos"
              value={reports.users?.candidatos || 0}
              color="#10b981"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />
            <ReportCard
              title="Empresas"
              value={reports.users?.empresas || 0}
              color="#f59e0b"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <ReportCard
              title="Administradores"
              value={reports.users?.admins || 0}
              color="#8b5cf6"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
            />
          </div>

          <div className={`${styles.surface} ${styles.panel}`} style={{ marginTop: '1.5rem' }}>
            <h3 className={styles.chartTitle}>Distribuição de utilizadores</h3>
            <div className={styles.metricList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Candidatos</span>
                <div className={styles.metricTrack}>
                  <div className={styles.metricFill} style={{ '--metric-width': `${safePercent(reports.users?.candidatos, userTotal)}%`, '--metric-color': '#10b981' }} />
                </div>
                <span className={styles.metricValue}>{reports.users?.candidatos || 0}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Empresas</span>
                <div className={styles.metricTrack}>
                  <div className={styles.metricFill} style={{ '--metric-width': `${safePercent(reports.users?.empresas, userTotal)}%`, '--metric-color': '#f59e0b' }} />
                </div>
                <span className={styles.metricValue}>{reports.users?.empresas || 0}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Administradores</span>
                <div className={styles.metricTrack}>
                  <div className={styles.metricFill} style={{ '--metric-width': `${safePercent(reports.users?.admins, userTotal)}%`, '--metric-color': '#8b5cf6' }} />
                </div>
                <span className={styles.metricValue}>{reports.users?.admins || 0}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Relatório de Vagas</h2>
          <div className={styles.gridStats}>
            <ReportCard
              title="Total de Vagas"
              value={jobTotal}
              color="#3b82f6"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <ReportCard
              title="Vagas Ativas"
              value={reports.jobs?.active || 0}
              color="#10b981"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <ReportCard
              title="Vagas Fechadas"
              value={reports.jobs?.closed || 0}
              color="#ef4444"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <ReportCard
              title="Candidaturas"
              value={reports.applications?.total || 0}
              color="#8b5cf6"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
          </div>

          <div className={`${styles.surface} ${styles.panel}`} style={{ marginTop: '1.5rem' }}>
            <h3 className={styles.chartTitle}>Estado das vagas</h3>
            <div className={styles.metricList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Ativas</span>
                <div className={styles.metricTrack}>
                  <div className={styles.metricFill} style={{ '--metric-width': `${safePercent(reports.jobs?.active, jobTotal)}%`, '--metric-color': '#10b981' }} />
                </div>
                <span className={styles.metricValue}>{reports.jobs?.active || 0}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Fechadas</span>
                <div className={styles.metricTrack}>
                  <div className={styles.metricFill} style={{ '--metric-width': `${safePercent(reports.jobs?.closed, jobTotal)}%`, '--metric-color': '#ef4444' }} />
                </div>
                <span className={styles.metricValue}>{reports.jobs?.closed || 0}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Desativadas</span>
                <div className={styles.metricTrack}>
                  <div className={styles.metricFill} style={{ '--metric-width': `${safePercent(reports.jobs?.disabled, jobTotal)}%`, '--metric-color': '#94a3b8' }} />
                </div>
                <span className={styles.metricValue}>{reports.jobs?.disabled || 0}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Atividades Recentes</h2>
          <div className={`${styles.surface} ${styles.panel}`}>
            {activities.length > 0 ? (
              <div className={styles.activityList}>
                {activities.map((activity, index) => (
                  <div key={activity.id || index} className={styles.activityItem}>
                    <div className={styles.activityIcon} style={{ '--activity-color': getActivityColor(activity.type) }}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className={styles.activityBody}>
                      <p className={styles.activityText}>{activity.description || 'Atividade sem descrição'}</p>
                      <p className={styles.activityDate}>
                        {activity.date
                          ? new Date(activity.date).toLocaleString('pt-PT', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>Nenhuma atividade recente para exibir.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return redirectToLogin(context);
    }

    try {
      const token = await admin.auth().verifyIdToken(cookies.token);
      const { uid } = token;

      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return redirectToLogin(context);
      }

      const userData = userDoc.data();
      if (userData.userType !== 'admin') {
        return redirectToLogin(context);
      }

      const [
        usersSnapshot,
        candidatosSnapshot,
        empresasSnapshot,
        adminsSnapshot,
        jobsSnapshot,
        activeJobsSnapshot,
        closedJobsSnapshot,
        disabledJobsSnapshot,
        applicationsSnapshot,
        activitiesSnapshot
      ] = await Promise.all([
        admin.firestore().collection('users').get(),
        admin.firestore().collection('users').where('userType', '==', 'candidato').get(),
        admin.firestore().collection('users').where('userType', '==', 'empresa').get(),
        admin.firestore().collection('users').where('userType', '==', 'admin').get(),
        admin.firestore().collection('jobs').get(),
        admin.firestore().collection('jobs').where('status', '==', 'active').get(),
        admin.firestore().collection('jobs').where('status', '==', 'closed').get(),
        admin.firestore().collection('jobs').where('status', '==', 'disabled').get(),
        admin.firestore().collection('applications').get(),
        admin.firestore().collection('activities').orderBy('createdAt', 'desc').limit(10).get()
      ]);

      const activities = activitiesSnapshot.docs.map((doc) => {
        const data = doc.data();
        let formattedDate = null;

        if (data.createdAt) {
          if (data.createdAt.toDate) {
            formattedDate = data.createdAt.toDate().toISOString();
          } else if (data.createdAt instanceof Date) {
            formattedDate = data.createdAt.toISOString();
          } else {
            formattedDate = new Date(data.createdAt).toISOString();
          }
        }

        return {
          id: doc.id,
          type: data.type || null,
          description: data.description || null,
          date: formattedDate,
          userId: data.userId || null
        };
      });

      return {
        props: {
          reports: {
            users: {
              total: usersSnapshot.size,
              candidatos: candidatosSnapshot.size,
              empresas: empresasSnapshot.size,
              admins: adminsSnapshot.size
            },
            jobs: {
              total: jobsSnapshot.size,
              active: activeJobsSnapshot.size,
              closed: closedJobsSnapshot.size,
              disabled: disabledJobsSnapshot.size
            },
            applications: {
              total: applicationsSnapshot.size
            },
            activities
          }
        }
      };
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return redirectToLogin(context);
    }
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return redirectToLogin(context);
  }
}
