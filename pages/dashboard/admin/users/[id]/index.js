import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import nookies from 'nookies';
import { admin } from '../../../../../lib/firebaseAdmin';
import LandingHeader from '../../../../../components/LandingHeader';

export default function AdminUserDetail({ user, profile, applications }) {
  const [form, setForm] = useState({
    name: user?.name || user?.fullName || '',
    userType: user?.userType || 'candidato',
    status: user?.status || 'active'
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage('');
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Falha ao atualizar usuário');
      setMessage('✅ Usuário atualizado com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage(`❌ Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Tem certeza que deseja desativar este usuário?')) return;
    try {
      setLoading(true);
      setMessage('');
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao desativar usuário');
      setForm((p) => ({ ...p, status: 'inactive' }));
      setMessage('✅ Usuário desativado');
    } catch (e) {
      setMessage(`❌ Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
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
          <h2 style={{ color: 'white' }}>Usuário não encontrado</h2>
          <Link href="/dashboard/admin/users" style={{ color: '#60a5fa' }}>Voltar</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{user.name || user.email} - Admin</title>
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
          <Link href="/dashboard/admin/users" style={{
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
            Voltar para Usuários
          </Link>
          <h1 style={{ margin: '0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
            Detalhes do Usuário
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

        {/* Grid de 2 Colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          {/* Informações do Usuário */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
              Informações
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {(user.photoUrl || profile?.photoUrl) && (
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src={user.photoUrl || profile.photoUrl} 
                    alt="Foto" 
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #3b82f6',
                      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
                    }}
                  />
                </div>
              )}
              
              <InfoItem label="Nome" value={user.name || user.fullName || 'Não informado'} />
              <InfoItem label="Email" value={user.email} />
              <InfoItem label="Telefone" value={profile?.phone || user.phone || 'Não informado'} />
              <InfoItem label="Localização" value={profile?.location || user.location || user.cidade || 'Não informado'} />
              <InfoItem label="Tipo de Usuário" value={<UserTypeBadge type={user.userType} />} />
              <InfoItem label="Provider" value={user.provider || 'email'} />
              
              {user.createdAt && (
                <InfoItem 
                  label="Data de Criação" 
                  value={new Date(user.createdAt).toLocaleString('pt-PT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })} 
                />
              )}
            </div>

            {/* Botão Ver Perfil Completo */}
            {user.userType === 'candidato' && (
              <Link
                href={`/dashboard/empresa/candidato/${user.id}`}
                style={{
                  display: 'block',
                  marginTop: '2rem',
                  padding: '0.875rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  textAlign: 'center',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                }}
              >
                Ver Perfil Completo
              </Link>
            )}
          </div>

          {/* Editar Usuário */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
              Editar Informações
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.9rem' }}>
                  Nome
                </label>
                <input
                  value={form.name}
                  name="name"
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.9rem' }}>
                  Tipo de Usuário
                </label>
                <select
                  value={form.userType}
                  name="userType"
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="candidato" style={{ background: '#1e293b' }}>Candidato</option>
                  <option value="empresa" style={{ background: '#1e293b' }}>Empresa</option>
                  <option value="admin" style={{ background: '#1e293b' }}>Administrador</option>
                  </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '600', fontSize: '0.9rem' }}>
                  Status
                </label>
                <select
                  value={form.status}
                  name="status"
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="active" style={{ background: '#1e293b' }}>Ativo</option>
                  <option value="suspended" style={{ background: '#1e293b' }}>Suspenso</option>
                  <option value="inactive" style={{ background: '#1e293b' }}>Inativo</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  disabled={loading}
                  onClick={handleSave}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    background: loading ? 'rgba(59, 130, 246, 0.5)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: '700',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
                <button
                  disabled={loading || form.status === 'inactive'}
                  onClick={handleDeactivate}
                  style={{
                    padding: '0.875rem 1.5rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#fca5a5',
                    border: '2px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    fontWeight: '700',
                    cursor: (loading || form.status === 'inactive') ? 'not-allowed' : 'pointer',
                    opacity: (loading || form.status === 'inactive') ? 0.5 : 1
                  }}
                >
                  Desativar
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Candidaturas (se for candidato) */}
        {user.userType === 'candidato' && applications.length > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            marginTop: '2rem'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
              Histórico de Candidaturas ({applications.length})
            </h3>
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
                      {app.jobTitle || 'Vaga'}
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
                  <ApplicationStatusBadge status={app.status} />
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
        {label}
      </div>
      <div style={{ color: 'white', fontSize: '1.05rem', fontWeight: '600' }}>
        {value}
      </div>
    </div>
  );
}

function UserTypeBadge({ type }) {
  let color, bgColor, borderColor, label;
  
  if (type === 'candidato') {
    color = '#34d399';
    bgColor = 'rgba(16, 185, 129, 0.2)';
    borderColor = 'rgba(16, 185, 129, 0.3)';
    label = 'Candidato';
  } else if (type === 'empresa') {
    color = '#fbbf24';
    bgColor = 'rgba(251, 191, 36, 0.2)';
    borderColor = 'rgba(251, 191, 36, 0.3)';
    label = 'Empresa';
  } else if (type === 'admin') {
    color = '#a78bfa';
    bgColor = 'rgba(139, 92, 246, 0.2)';
    borderColor = 'rgba(139, 92, 246, 0.3)';
    label = 'Admin';
  } else {
    color = '#94a3b8';
    bgColor = 'rgba(100, 116, 139, 0.2)';
    borderColor = 'rgba(100, 116, 139, 0.3)';
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

function ApplicationStatusBadge({ status }) {
  let color, bgColor, borderColor, label;
  
  if (status === 'approved') {
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
    color = '#fbbf24';
    bgColor = 'rgba(245, 158, 11, 0.2)';
    borderColor = 'rgba(245, 158, 11, 0.3)';
    label = 'Pendente';
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
    const cookies = nookies.get(ctx);
    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const adminDoc = await admin.firestore().collection('users').doc(token.uid).get();
    
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const { id } = ctx.query;
    
    // Buscar usuário
    const userDoc = await admin.firestore().collection('users').doc(id).get();
    if (!userDoc.exists) {
      return { notFound: true };
    }
    
    const userData = userDoc.data();
    
    // Buscar perfil detalhado
    const profileDoc = await admin.firestore().collection('profiles').doc(id).get();
    const profileData = profileDoc.exists ? profileDoc.data() : {};

    // Buscar candidaturas (se for candidato)
    let applications = [];
    if (userData.userType === 'candidato') {
      const applicationsSnap = await admin.firestore()
        .collection('applications')
        .where('candidateId', '==', id)
        .get();
      
      applications = applicationsSnap.docs.map(doc => {
        const appData = doc.data();
        return {
          id: doc.id,
          jobTitle: appData.jobTitle || '',
          status: appData.status || 'pending',
          createdAt: tsToMillis(appData.createdAt) ? new Date(tsToMillis(appData.createdAt)).toISOString() : null
        };
      });
    }

    const user = {
      id: userDoc.id,
      name: userData.name || userData.fullName || '',
      fullName: userData.fullName || userData.name || '',
      email: userData.email || '',
      phone: userData.phone || '',
      location: userData.location || userData.cidade || '',
      userType: userData.userType || '',
      photoUrl: userData.photoUrl || '',
      status: userData.status || 'active',
      provider: userData.provider || 'email',
      createdAt: tsToMillis(userData.createdAt) ? new Date(tsToMillis(userData.createdAt)).toISOString() : null,
      updatedAt: tsToMillis(userData.updatedAt) ? new Date(tsToMillis(userData.updatedAt)).toISOString() : null,
      planEndDate: tsToMillis(userData.planEndDate) ? new Date(tsToMillis(userData.planEndDate)).toISOString() : null
    };

    return { 
      props: { 
        user,
        profile: profileData,
        applications
      } 
    };
  } catch (e) {
    console.error('Erro ao carregar usuário admin:', e);
    return { redirect: { destination: '/login', permanent: false } };
  }
}
