import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { admin } from '../../../lib/firebaseAdmin';
import nookies from 'nookies';
import LandingHeader from '../../../components/LandingHeader';

export default function AdminJobs({ jobs = [] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.localizacao?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      job.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: jobs.length,
    active: jobs.filter(j => j.status === 'active').length,
    closed: jobs.filter(j => j.status === 'closed').length,
    disabled: jobs.filter(j => j.status === 'disabled').length
  };

  return (
    <>
      <Head>
        <title>Gerenciar Vagas - Admin</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
      <LandingHeader />

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link href="/dashboard/admin" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#60a5fa',
              textDecoration: 'none',
              fontWeight: '600',
              marginBottom: '1rem'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Voltar ao Dashboard
            </Link>
            <h1 style={{ margin: '0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
              Gerenciar Vagas
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
              {filteredJobs.length} de {jobs.length} vagas
            </p>
          </div>

          <Link href="/dashboard/admin/jobs/create" style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova Vaga
          </Link>
        </div>

        {/* Estatísticas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <StatCard title="Total" value={stats.total} color="#3b82f6" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
          <StatCard title="Ativas" value={stats.active} color="#10b981" active={filterStatus === 'active'} onClick={() => setFilterStatus('active')} />
          <StatCard title="Fechadas" value={stats.closed} color="#ef4444" active={filterStatus === 'closed'} onClick={() => setFilterStatus('closed')} />
          <StatCard title="Desativadas" value={stats.disabled} color="#64748b" active={filterStatus === 'disabled'} onClick={() => setFilterStatus('disabled')} />
        </div>

        {/* Filtros */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600' }}>
                Pesquisar
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Título, empresa ou localização..."
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#60a5fa';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>

            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  alignSelf: 'flex-end',
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '2px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#fca5a5',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                Limpar Pesquisa
              </button>
            )}
          </div>
        </div>

        {/* Tabela de Vagas */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          {filteredJobs.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.3rem' }}>
                Nenhuma vaga encontrada
              </h3>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
                {searchTerm ? 'Tente ajustar os filtros de pesquisa' : 'Nenhuma vaga cadastrada no sistema'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Título</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Empresa</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Localização</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Candidaturas</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Views</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Data</th>
                    <th style={{ padding: '1rem', textAlign: 'right', color: 'white', fontWeight: '700' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '1rem', color: 'white', fontWeight: '600' }}>{job.titulo}</td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>{job.companyName || 'N/A'}</td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>{job.localizacao || 'N/A'}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <StatusBadge status={job.status} />
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>
                        {job.applicationCount || 0}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', color: '#34d399', fontWeight: '700' }}>
                        {job.views || 0}
                      </td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                        {job.createdAt ? new Date(job.createdAt).toLocaleDateString('pt-PT', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Link href={`/dashboard/admin/jobs/${job.id}`} style={{
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            Ver
                          </Link>
                          <Link href={`/dashboard/admin/jobs/${job.id}/edit`} style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#34d399',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function StatCard({ title, value, color, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${color}30` : 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: active ? `2px solid ${color}` : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '1.5rem',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 10px 30px ${color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: color, marginBottom: '0.5rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.95rem', color: 'white', fontWeight: '700' }}>
        {title}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  let color, bgColor, borderColor, label;

  if (status === 'active') {
    color = '#34d399';
    bgColor = 'rgba(16, 185, 129, 0.2)';
    borderColor = 'rgba(16, 185, 129, 0.3)';
    label = 'Ativa';
  } else if (status === 'closed') {
    color = '#fca5a5';
    bgColor = 'rgba(239, 68, 68, 0.2)';
    borderColor = 'rgba(239, 68, 68, 0.3)';
    label = 'Fechada';
  } else if (status === 'disabled') {
    color = '#94a3b8';
    bgColor = 'rgba(100, 116, 139, 0.2)';
    borderColor = 'rgba(100, 116, 139, 0.3)';
    label = 'Desativada';
  } else {
    color = '#cbd5e1';
    bgColor = 'rgba(203, 213, 225, 0.2)';
    borderColor = 'rgba(203, 213, 225, 0.3)';
    label = 'Desconhecido';
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '0.4rem 0.9rem',
      borderRadius: '12px',
      fontSize: '0.85rem',
      fontWeight: '700',
      backgroundColor: bgColor,
      color: color,
      border: `1px solid ${borderColor}`
    }}>
      {label}
    </span>
  );
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const userData = userDoc.data();

    if (userData.userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    console.log('📊 Buscando todas as vagas...');

    // Buscar todas as vagas
    const jobsSnapshot = await admin.firestore()
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .get();

    console.log(`✅ ${jobsSnapshot.size} vagas encontradas`);

    // Buscar candidaturas em batch
    const applicationsSnapshot = await admin.firestore()
      .collection('applications')
      .get();

    const applicationsByJob = {};
    applicationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const jobId = data.jobId;
      if (jobId) {
        applicationsByJob[jobId] = (applicationsByJob[jobId] || 0) + 1;
      }
    });

    console.log('✅ Candidaturas contadas');

    // Buscar empresas em batch
    const companyIds = [...new Set(jobsSnapshot.docs
      .map(doc => doc.data().companyId)
      .filter(Boolean))];

    const companiesMap = {};

    if (companyIds.length > 0) {
      // Firestore permite no máximo 10 items em 'in' query, então fazer em batches
      const batches = [];
      for (let i = 0; i < companyIds.length; i += 10) {
        batches.push(companyIds.slice(i, i + 10));
      }

      for (const batch of batches) {
        const companiesSnapshot = await admin.firestore()
          .collection('users')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();

        companiesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          companiesMap[doc.id] = data.name || data.fullName || 'Empresa';
        });
      }
    }

    console.log('✅ Empresas carregadas');

    // Montar dados das vagas
    const jobs = jobsSnapshot.docs.map(doc => {
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
        companyName: companiesMap[data.companyId] || 'N/A',
        applicationCount: applicationsByJob[doc.id] || 0,
        views: data.views || 0,
        createdAt: typeof data.createdAt === 'string'
          ? data.createdAt
          : data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      };
    });

    console.log('✅ Dados montados');

    return {
      props: { jobs }
    };
  } catch (error) {
    console.error('❌ Erro no getServerSideProps:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
}
