import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { admin } from '../../../../../lib/firebaseAdmin';
import nookies from 'nookies';
import LandingHeader from '../../../../../components/LandingHeader';

export default function AdminJobDetail({ job, company, applications, error }) {
  const [status, setStatus] = useState(job?.status || 'active');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async (newStatus) => {
    try {
      setLoading(true);
      setMessage('');
      
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: job.titulo,
          descricao: job.descricao,
          status: newStatus
        })
      });
      
      if (!res.ok) throw new Error('Falha ao atualizar vaga');
      
      setStatus(newStatus);
      setMessage('✅ Vaga atualizada com sucesso!');
      
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage(`❌ Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!job || error) {
    return (
      <>
        <Head>
          <style>{`
            body {
              background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
              min-height: 100vh;
            }
          `}</style>
        </Head>
        <LandingHeader />
        <main style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{
            maxWidth: '500px',
            margin: '0 auto',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '3rem 2rem'
          }}>
            <h2 style={{ color: 'white', fontSize: '1.8rem', marginBottom: '1rem' }}>Vaga não encontrada</h2>
            {error && (
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem' }}>
                Erro: {error}
              </p>
            )}
            <Link href="/dashboard/admin/jobs" style={{
              display: 'inline-block',
              padding: '0.875rem 1.75rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: '700',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
            }}>
              Voltar para Vagas
            </Link>
          </div>
        </main>
      </>
    );
  }

  const pendingApps = applications.filter(a => a.status === 'pending' || !a.status).length;
  const approvedApps = applications.filter(a => a.status === 'approved').length;
  const rejectedApps = applications.filter(a => a.status === 'rejected').length;

  return (
    <>
      <Head>
        <title>{job.titulo} - Admin</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
      <LandingHeader />
      
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', minHeight: '100vh' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/dashboard/admin/jobs" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#60a5fa',
            textDecoration: 'none',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Voltar para Vagas
          </Link>
          <h1 style={{ margin: '0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
            {job.titulo}
          </h1>
        </div>

        {/* Mensagem */}
        {message && (
          <div style={{
            background: message.includes('sucesso') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.includes('sucesso') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
            color: message.includes('sucesso') ? '#6ee7b7' : '#fca5a5',
            fontWeight: '600'
          }}>
            {message}
          </div>
        )}

        {/* Informações Principais */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            
            <InfoItem label="Empresa" value={company?.name || company?.fullName || 'Não informado'} />
            <InfoItem label="Localização" value={job.localizacao || 'Não informado'} />
            <InfoItem label="Tipo de Contrato" value={job.tipoContrato || 'Não informado'} />
            <InfoItem 
              label="Status" 
              value={
                <StatusBadge status={status} />
              } 
            />
            <InfoItem label="Visualizações" value={job.views || 0} />
            <InfoItem label="Candidaturas" value={applications.length} />
            
            </div>

          {/* Datas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {job.createdAt && <InfoItem label="Criada em" value={new Date(job.createdAt).toLocaleString('pt-PT')} />}
            {job.dataAbertura && <InfoItem label="Abertura" value={job.dataAbertura} />}
            {job.dataFecho && <InfoItem label="Encerramento" value={job.dataFecho} />}
              </div>
            </div>

        {/* Botões de Ação */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
            Alterar Status
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              disabled={loading || status === 'active'}
              onClick={() => handleUpdateStatus('active')}
              style={{
                padding: '0.75rem 1.5rem',
                background: status === 'active' ? 'rgba(16, 185, 129, 0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '700',
                cursor: (loading || status === 'active') ? 'not-allowed' : 'pointer',
                opacity: (loading || status === 'active') ? 0.5 : 1
              }}
            >
              {loading ? 'Processando...' : 'Ativar Vaga'}
            </button>
            <button
              disabled={loading || status === 'closed'}
              onClick={() => handleUpdateStatus('closed')}
              style={{
                padding: '0.75rem 1.5rem',
                background: status === 'closed' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(245, 158, 11, 0.2)',
                color: status === 'closed' ? '#fbbf24' : '#fbbf24',
                border: '2px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                fontWeight: '700',
                cursor: (loading || status === 'closed') ? 'not-allowed' : 'pointer',
                opacity: (loading || status === 'closed') ? 0.5 : 1
              }}
            >
              {loading ? 'Processando...' : 'Fechar Vaga'}
            </button>
            <button
              disabled={loading || status === 'disabled'}
              onClick={() => handleUpdateStatus('disabled')}
              style={{
                padding: '0.75rem 1.5rem',
                background: status === 'disabled' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(239, 68, 68, 0.2)',
                color: status === 'disabled' ? '#fca5a5' : '#fca5a5',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                fontWeight: '700',
                cursor: (loading || status === 'disabled') ? 'not-allowed' : 'pointer',
                opacity: (loading || status === 'disabled') ? 0.5 : 1
              }}
            >
              {loading ? 'Processando...' : 'Desativar Vaga'}
            </button>
            <Link
              href={`/dashboard/admin/jobs/${job.id}/edit`}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                fontWeight: '700',
                textDecoration: 'none',
                display: 'inline-block',
                marginLeft: 'auto'
              }}
            >
              Editar Vaga
            </Link>
          </div>
          </div>

        {/* Descrição e Detalhes */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
            Descrição da Vaga
          </h3>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {job.descricao || 'Sem descrição'}
          </p>

          {job.requisitos && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                Requisitos
              </h4>
              <ul style={{ paddingLeft: '1.5rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.8, margin: 0 }}>
                {(typeof job.requisitos === 'string' 
                  ? job.requisitos.split(',').map(r => r.trim())
                  : Array.isArray(job.requisitos) ? job.requisitos : []
                ).map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {job.beneficios && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                Benefícios
              </h4>
              <ul style={{ paddingLeft: '1.5rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.8, margin: 0 }}>
                {(typeof job.beneficios === 'string' 
                  ? job.beneficios.split(',').map(b => b.trim())
                  : []
                ).map((ben, idx) => (
                  <li key={idx}>{ben}</li>
                ))}
              </ul>
            </div>
          )}

          {(job.salarioDe || job.salarioAte) && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                Salário
              </h4>
              <p style={{ margin: 0, color: '#34d399', fontSize: '1.2rem', fontWeight: '700' }}>
                {job.salarioDe && `${Number(job.salarioDe).toLocaleString('pt-PT')} Db`}
                {job.salarioDe && job.salarioAte && ' - '}
                {job.salarioAte && `${Number(job.salarioAte).toLocaleString('pt-PT')} Db`}
              </p>
            </div>
          )}
        </div>

        {/* Candidaturas */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
              Candidaturas ({applications.length})
            </h3>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <span style={{ padding: '0.4rem 0.9rem', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', color: '#fbbf24', fontSize: '0.9rem', fontWeight: '700' }}>
                {pendingApps} Pendentes
              </span>
              <span style={{ padding: '0.4rem 0.9rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', color: '#34d399', fontSize: '0.9rem', fontWeight: '700' }}>
                {approvedApps} Aprovadas
              </span>
              <span style={{ padding: '0.4rem 0.9rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#fca5a5', fontSize: '0.9rem', fontWeight: '700' }}>
                {rejectedApps} Rejeitadas
              </span>
            </div>
          </div>

          {applications.length === 0 ? (
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', padding: '2rem' }}>
              Nenhuma candidatura ainda
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {applications.map((app) => (
                <div key={app.id} style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ color: 'white', fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                      {app.candidateName || 'Candidato'}
                    </div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      {app.candidateEmail || ''}
                    </div>
                    {app.createdAt && (
                      <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                        {new Date(app.createdAt).toLocaleDateString('pt-PT', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <StatusBadge status={app.status} />
                    {app.candidateId && (
                      <Link
                        href={`/dashboard/empresa/candidato/${app.candidateId}`}
                        style={{
                          padding: '0.6rem 1.25rem',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '10px',
                          fontWeight: '700',
                          fontSize: '0.9rem'
                        }}
                      >
                        Ver Perfil
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ color: 'white', fontSize: '1.05rem', fontWeight: '700' }}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  let color, bgColor, borderColor, label;
  
  if (status === 'active' || !status) {
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
  } else if (status === 'pending') {
    color = '#fbbf24';
    bgColor = 'rgba(245, 158, 11, 0.2)';
    borderColor = 'rgba(245, 158, 11, 0.3)';
    label = 'Pendente';
  } else if (status === 'approved') {
    color = '#34d399';
    bgColor = 'rgba(16, 185, 129, 0.2)';
    borderColor = 'rgba(16, 185, 129, 0.3)';
    label = 'Aprovada';
  } else if (status === 'rejected') {
    color = '#fca5a5';
    bgColor = 'rgba(239, 68, 68, 0.2)';
    borderColor = 'rgba(239, 68, 68, 0.3)';
    label = 'Rejeitada';
  } else {
    color = '#cbd5e1';
    bgColor = 'rgba(203, 213, 225, 0.2)';
    borderColor = 'rgba(203, 213, 225, 0.3)';
    label = status;
  }
  
  return (
    <span style={{ 
      display: 'inline-block',
      padding: '0.5rem 1rem',
      borderRadius: '12px',
      fontSize: '0.9rem',
      fontWeight: '700',
      backgroundColor: bgColor,
      color: color,
      border: `2px solid ${borderColor}`
    }}>
      {label}
    </span>
  );
}

function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts === 'number') return ts;
  return null;
}

export async function getServerSideProps(ctx) {
  try {
    // Não destruir o token antes de usar
    const cookies = nookies.get(ctx);
    
    if (!cookies.token) {
      console.log('❌ Token não encontrado');
      return { redirect: { destination: '/login', permanent: false } };
    }

    console.log('🔐 Verificando token...');
    const token = await admin.auth().verifyIdToken(cookies.token);
    const uid = token.uid;
    
    console.log('👤 UID:', uid);
    
    const adminDoc = await admin.firestore().collection('users').doc(uid).get();
    
    if (!adminDoc.exists) {
      console.log('❌ Documento de usuário não existe');
      return { redirect: { destination: '/login', permanent: false } };
    }
    
    const userData = adminDoc.data();
    console.log('✅ UserType:', userData.userType);
    
    if (userData.userType !== 'admin') {
      console.log('❌ Usuário não é admin');
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    console.log('✅ Admin verificado');

    const { id } = ctx.query;
    console.log('📝 Buscando vaga:', id);
    
    const jobSnap = await admin.firestore().collection('jobs').doc(id).get();
    
    if (!jobSnap.exists) {
      console.log('❌ Vaga não encontrada');
      return { notFound: true };
    }

    console.log('✅ Vaga encontrada');
    const data = jobSnap.data();
    
    // Buscar empresa
    let company = null;
    if (data.companyId) {
      try {
        console.log('🏢 Buscando empresa:', data.companyId);
        const companyDoc = await admin.firestore().collection('users').doc(data.companyId).get();
        if (companyDoc.exists) {
          company = companyDoc.data();
          console.log('✅ Empresa encontrada:', company.name || company.fullName);
        } else {
          console.log('⚠️ Empresa não encontrada');
        }
      } catch (companyError) {
        console.error('Erro ao buscar empresa:', companyError);
      }
    }

    // Buscar candidaturas
    let applications = [];
    try {
      console.log('👥 Buscando candidaturas...');
      const applicationsSnap = await admin.firestore()
        .collection('applications')
        .where('jobId', '==', id)
        .get();

      applications = applicationsSnap.docs.map(doc => {
        const appData = doc.data();
        return {
          id: doc.id,
          candidateId: appData.candidateId || '',
          candidateName: appData.candidateName || '',
          candidateEmail: appData.candidateEmail || '',
          status: appData.status || 'pending',
          createdAt: tsToMillis(appData.createdAt) ? new Date(tsToMillis(appData.createdAt)).toISOString() : null
        };
      });
      
      console.log(`✅ ${applications.length} candidaturas encontradas`);
    } catch (appsError) {
      console.error('Erro ao buscar candidaturas:', appsError);
      applications = [];
    }

    const job = {
      id: jobSnap.id,
      titulo: data.titulo || 'Sem título',
      descricao: data.descricao || '',
      requisitos: data.requisitos || '',
      localizacao: data.localizacao || '',
      tipoContrato: data.tipoContrato || '',
      salarioDe: data.salarioDe || '',
      salarioAte: data.salarioAte || '',
      beneficios: data.beneficios || '',
      dataAbertura: data.dataAbertura || '',
      dataFecho: data.dataFecho || '',
      status: data.status || 'active',
      views: data.views || 0,
      companyId: data.companyId || '',
      createdAt: tsToMillis(data.createdAt) ? new Date(tsToMillis(data.createdAt)).toISOString() : null,
      updatedAt: tsToMillis(data.updatedAt) ? new Date(tsToMillis(data.updatedAt)).toISOString() : null
    };

    console.log('✅ Dados montados com sucesso');
    console.log('Vaga:', job.titulo);
    console.log('Empresa:', company?.name || 'N/A');
    console.log('Candidaturas:', applications.length);

    return { 
      props: { 
        job,
        company: company || null,
        applications
      } 
    };
  } catch (e) {
    console.error('❌ Erro ao carregar vaga admin:', e);
    console.error('Stack:', e.stack);
    
    // Se for erro de autenticação, redirecionar
    if (e.code === 'auth/id-token-expired' || e.code === 'auth/argument-error') {
    return { redirect: { destination: '/login', permanent: false } };
    }
    
    // Outros erros, tentar mostrar a página com erro
    return {
      props: {
        job: null,
        company: null,
        applications: [],
        error: e.message
      }
    };
  }
}
