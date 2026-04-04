import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { admin } from '../../../lib/firebaseAdmin';
import nookies from 'nookies';
import LandingHeader from '../../../components/LandingHeader';

export default function AdminUsers({ users = [] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = 
      filterType === 'all' || 
      user.userType === filterType;
    
    return matchesSearch && matchesType;
  });

  const stats = {
    total: users.length,
    candidatos: users.filter(u => u.userType === 'candidato').length,
    empresas: users.filter(u => u.userType === 'empresa').length,
    admins: users.filter(u => u.userType === 'admin').length
  };

  return (
    <>
      <Head>
        <title>Gerenciar Usuários - Admin</title>
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
        <div style={{ marginBottom: '2rem' }}>
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
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Voltar ao Dashboard
          </Link>
          <h1 style={{ margin: '0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
            Gerenciar Usuários
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
            {filteredUsers.length} de {users.length} usuários
          </p>
        </div>
        
        {/* Estatísticas */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <StatCard title="Total" value={stats.total} color="#3b82f6" active={filterType === 'all'} onClick={() => setFilterType('all')} />
          <StatCard title="Candidatos" value={stats.candidatos} color="#10b981" active={filterType === 'candidato'} onClick={() => setFilterType('candidato')} />
          <StatCard title="Empresas" value={stats.empresas} color="#f59e0b" active={filterType === 'empresa'} onClick={() => setFilterType('empresa')} />
          <StatCard title="Admins" value={stats.admins} color="#8b5cf6" active={filterType === 'admin'} onClick={() => setFilterType('admin')} />
        </div>
        
        {/* Barra de Pesquisa */}
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
                placeholder="Nome, email ou telefone..."
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
                  cursor: 'pointer'
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        
        {/* Tabela de Usuários */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          {filteredUsers.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.3rem' }}>
                Nenhum usuário encontrado
              </h3>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
                Tente ajustar os filtros de pesquisa
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Nome</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Email</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Telefone</th>
                    <th style={{ padding: '1rem', textAlign: 'center', color: 'white', fontWeight: '700' }}>Tipo</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Localização</th>
                    <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Data</th>
                    <th style={{ padding: '1rem', textAlign: 'right', color: 'white', fontWeight: '700' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '1rem', color: 'white', fontWeight: '600' }}>
                        {user.name || user.fullName || 'Não informado'}
                      </td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>
                        {user.email}
                      </td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                        {user.phone || '—'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <UserTypeBadge type={user.userType} />
                      </td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                        {user.location || user.cidade || '—'}
                      </td>
                      <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>Não disponível</span>}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Link href={`/dashboard/admin/users/${user.id}`} style={{
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
                          <Link href={`/dashboard/admin/users/${user.id}/edit`} style={{
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

    console.log('📊 Buscando todos os usuários...');

    // Buscar todos os usuários
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .orderBy('createdAt', 'desc')
      .get();

    console.log(`✅ ${usersSnapshot.size} usuários encontrados`);

    // Buscar perfis detalhados (profiles)
    const profilesSnapshot = await admin.firestore()
      .collection('profiles')
      .get();

    const profilesMap = {};
    profilesSnapshot.docs.forEach(doc => {
      profilesMap[doc.id] = doc.data();
    });

    console.log(`✅ ${profilesSnapshot.size} perfis encontrados`);

    const serializeTs = (v) => {
      if (!v) return null;
      if (typeof v.toMillis === 'function') return v.toMillis();
      if (typeof v.toDate === 'function') return v.toDate().getTime();
      if (typeof v === 'number') return v;
      return null;
    };

    const users = usersSnapshot.docs.map(doc => {
      const userData = doc.data();
      const profileData = profilesMap[doc.id] || {};
      
      // Debug para o primeiro usuário
      if (doc.id === usersSnapshot.docs[0]?.id) {
        console.log('📋 Exemplo de usuário:', {
          id: doc.id,
          createdAt: userData.createdAt,
          createdAtType: typeof userData.createdAt,
          serialized: serializeTs(userData.createdAt)
        });
      }
      
      return {
        id: doc.id,
        name: userData.name || userData.fullName || profileData.fullName || '',
        fullName: userData.fullName || userData.name || profileData.fullName || '',
        email: userData.email || '',
        phone: profileData.phone || userData.phone || '',
        location: profileData.location || userData.location || userData.cidade || '',
        userType: userData.userType || '',
        photoUrl: profileData.photoUrl || userData.photoUrl || '',
        createdAt: serializeTs(userData.createdAt) || serializeTs(profileData.createdAt) || null,
        updatedAt: serializeTs(userData.updatedAt) || serializeTs(profileData.updatedAt) || null,
        planEndDate: serializeTs(userData.planEndDate) || null,
        currentPlan: userData.currentPlan || '',
        provider: userData.provider || 'email'
      };
    });

    console.log('✅ Dados dos usuários serializados');
    console.log(`📅 Exemplo de data serializada: ${users[0]?.createdAt}`);

    return {
      props: { users }
    };
  } catch (error) {
    console.error('❌ Erro no getServerSideProps:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
}
