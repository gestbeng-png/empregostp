import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { admin } from '../../../lib/firebaseAdmin';
import nookies from 'nookies';
import LandingHeader from '../../../components/LandingHeader';

export default function AdminReports({ reports = {} }) {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Relatórios - Admin Dashboard</title>
      </Head>
      <LandingHeader />

      <main style={{ maxWidth: 1200, margin: '2.5rem auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1a202c' }}>Relatórios</h1>
          <Link href="/dashboard/admin" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            backgroundColor: '#f7fafc',
            border: '1px solid #e2e8f0',
            color: '#4a5568',
            textDecoration: 'none',
            fontSize: '0.875rem'
          }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar ao Dashboard
          </Link>
        </div>

        {/* Relatório de usuários */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#2d3748' }}>Relatório de Usuários</h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <ReportCard
              title="Total de Usuários"
              value={reports.users?.total || 0}
              color="#4299e1"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />

            <ReportCard
              title="Candidatos"
              value={reports.users?.candidatos || 0}
              color="#48bb78"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <ReportCard
              title="Empresas"
              value={reports.users?.empresas || 0}
              color="#ed8936"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />

            <ReportCard
              title="Administradores"
              value={reports.users?.admins || 0}
              color="#9f7aea"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
            />
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '1.125rem', marginTop: 0, marginBottom: '1rem', color: '#2d3748' }}>
              Crescimento de Usuários
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>Candidatos</span>
                <div style={{ flex: 1, margin: '0 1rem', height: '0.5rem', backgroundColor: '#edf2f7', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(reports.users?.candidatos / reports.users?.total) * 100}%`, height: '100%', backgroundColor: '#48bb78' }}></div>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#4a5568', fontWeight: '500' }}>{reports.users?.candidatos || 0}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>Empresas</span>
                <div style={{ flex: 1, margin: '0 1rem', height: '0.5rem', backgroundColor: '#edf2f7', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(reports.users?.empresas / reports.users?.total) * 100}%`, height: '100%', backgroundColor: '#ed8936' }}></div>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#4a5568', fontWeight: '500' }}>{reports.users?.empresas || 0}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>Administradores</span>
                <div style={{ flex: 1, margin: '0 1rem', height: '0.5rem', backgroundColor: '#edf2f7', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(reports.users?.admins / reports.users?.total) * 100}%`, height: '100%', backgroundColor: '#9f7aea' }}></div>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#4a5568', fontWeight: '500' }}>{reports.users?.admins || 0}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Relatório de vagas */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#2d3748' }}>Relatório de Vagas</h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <ReportCard
              title="Total de Vagas"
              value={reports.jobs?.total || 0}
              color="#4299e1"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />

            <ReportCard
              title="Vagas Ativas"
              value={reports.jobs?.active || 0}
              color="#48bb78"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <ReportCard
              title="Vagas Fechadas"
              value={reports.jobs?.closed || 0}
              color="#f56565"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <ReportCard
              title="Candidaturas"
              value={reports.applications?.total || 0}
              color="#9f7aea"
              icon={
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '1.125rem', marginTop: 0, marginBottom: '1rem', color: '#2d3748' }}>
              Status das Vagas
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>Ativas</span>
                <div style={{ flex: 1, margin: '0 1rem', height: '0.5rem', backgroundColor: '#edf2f7', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(reports.jobs?.active / reports.jobs?.total) * 100}%`, height: '100%', backgroundColor: '#48bb78' }}></div>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#4a5568', fontWeight: '500' }}>{reports.jobs?.active || 0}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>Fechadas</span>
                <div style={{ flex: 1, margin: '0 1rem', height: '0.5rem', backgroundColor: '#edf2f7', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(reports.jobs?.closed / reports.jobs?.total) * 100}%`, height: '100%', backgroundColor: '#f56565' }}></div>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#4a5568', fontWeight: '500' }}>{reports.jobs?.closed || 0}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>Desativadas</span>
                <div style={{ flex: 1, margin: '0 1rem', height: '0.5rem', backgroundColor: '#edf2f7', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(reports.jobs?.disabled / reports.jobs?.total) * 100}%`, height: '100%', backgroundColor: '#a0aec0' }}></div>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#4a5568', fontWeight: '500' }}>{reports.jobs?.disabled || 0}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Relatório de atividades */}
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#2d3748' }}>Atividades Recentes</h2>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {reports.activities && reports.activities.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reports.activities.map((activity, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    backgroundColor: '#f7fafc',
                    gap: '1rem',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '50%',
                      backgroundColor: getActivityColor(activity.type),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: '#2d3748' }}>
                        {activity.description}
                      </p>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#718096' }}>
                        {activity.date ? new Date(activity.date).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#718096', textAlign: 'center' }}>Nenhuma atividade recente para exibir.</p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

// Componente para cartão de relatório
function ReportCard({ title, value, color, icon }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderTop: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500', color: '#4a5568' }}>{title}</h3>
        <div style={{ color: color }}>{icon}</div>
      </div>
      <p style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#2d3748' }}>{value}</p>
    </div>
  );
}

// Função para obter cor com base no tipo de atividade
function getActivityColor(type) {
  switch (type) {
    case 'user_created':
      return '#4299e1';
    case 'job_created':
      return '#48bb78';
    case 'job_updated':
      return '#ed8936';
    case 'application_created':
      return '#9f7aea';
    default:
      return '#a0aec0';
  }
}

// Função para obter ícone com base no tipo de atividade
function getActivityIcon(type) {
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
}

export async function getServerSideProps(context) {
  try {
    // Obtém os cookies do contexto do servidor
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    // Verifica o token
    try {
      const token = await admin.auth().verifyIdToken(cookies.token);
      const { uid } = token;

      // Busca perfil do usuário
      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return { redirect: { destination: '/login', permanent: false } };
      }

      const userData = userDoc.data();

      // Verifica se é um administrador
      if (userData.userType !== 'admin') {
        return { redirect: { destination: '/login', permanent: false } };
      }

      // Buscar dados para relatórios
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

      // Processar atividades recentes
      const activities = activitiesSnapshot.docs.map(doc => {
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
      return { redirect: { destination: '/login', permanent: false } };
    }
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
} 