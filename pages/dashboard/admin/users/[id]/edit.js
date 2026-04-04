import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { admin } from '../../../../../lib/firebaseAdmin';
import nookies from 'nookies';
import LandingHeader from '../../../../../components/LandingHeader';

export default function EditUser({ user }) {
  const router = useRouter();
  const { id } = router.query;
  
  const [formData, setFormData] = useState({
    name: user?.name || user?.fullName || '',
    email: user?.email || '',
    userType: user?.userType || 'candidato',
    status: user?.status || 'active'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao atualizar usuário');
      }
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/admin/users');
      }, 2000);
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Head>
        <title>Editar Usuário - Admin Dashboard</title>
      </Head>
      <LandingHeader />
      
      <main style={{ maxWidth: 800, margin: '2.5rem auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#1a202c' }}>Editar Usuário</h1>
          <Link href="/dashboard/admin/users" style={{
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
            Voltar para Usuários
          </Link>
        </div>
        
        {error && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fed7d7', 
            color: '#c53030', 
            borderRadius: '0.375rem',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#c6f6d5', 
            color: '#2f855a', 
            borderRadius: '0.375rem',
            marginBottom: '1.5rem'
          }}>
            Usuário atualizado com sucesso! Redirecionando...
          </div>
        )}
        
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.5rem', 
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Nome
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem'
                }}
                required
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  backgroundColor: '#edf2f7',
                  cursor: 'not-allowed'
                }}
                disabled
              />
              <p style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.5rem' }}>
                O email não pode ser alterado por questões de segurança.
              </p>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Tipo de Usuário
              </label>
              <select
                name="userType"
                value={formData.userType}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="candidato">Candidato</option>
                <option value="empresa">Empresa</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#4a5568' }}>
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <Link href="/dashboard/admin/users" style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #e2e8f0',
                color: '#4a5568',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4299e1',
                  color: 'white',
                  borderRadius: '0.375rem',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { id } = context.params;
    
    // Obtém os cookies do contexto do servidor
    const cookies = nookies.get(context);
    
    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    // Verifica o token
    try {
      const token = await admin.auth().verifyIdToken(cookies.token);
      const adminUid = token.uid;

      // Busca perfil do administrador
      const adminDoc = await admin.firestore().collection('users').doc(adminUid).get();
      if (!adminDoc.exists) {
        return { redirect: { destination: '/login', permanent: false } };
      }
      
      const adminData = adminDoc.data();
      
      // Verifica se é um administrador
      if (adminData.userType !== 'admin') {
        return { redirect: { destination: '/login', permanent: false } };
      }

      // Busca o usuário a ser editado
      const userDoc = await admin.firestore().collection('users').doc(id).get();
      if (!userDoc.exists) {
        return { 
          notFound: true
        };
      }
      
      return {
        props: { 
          user: {
            id: userDoc.id,
            ...userDoc.data()
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