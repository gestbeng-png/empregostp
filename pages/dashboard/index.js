import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Head from 'next/head';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    async function redirectUser() {
      if (!user) {
        // Se não estiver autenticado, redireciona para o login
        router.push('/login');
        return;
      }

      try {
        // Buscar o tipo de usuário no Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const userType = userData.userType;

          // Redirecionar com base no tipo de usuário
          if (userType === 'empresa') {
            router.push('/dashboard/empresa');
          } else if (userType === 'candidato') {
            router.push('/dashboard/candidato');
          } else if (userType === 'admin') {
            router.push('/dashboard/admin');
          } else {
            // Tipo de usuário desconhecido
            console.error('Tipo de usuário desconhecido:', userType);
            router.push('/');
          }
        } else {
          // Usuário não encontrado no Firestore
          console.error('Usuário não encontrado no Firestore');
          router.push('/');
        }
      } catch (error) {
        console.error('Erro ao buscar informações do usuário:', error);
        router.push('/');
      }
    }

    if (!loading) {
      redirectUser();
    }
  }, [user, loading, router]);

  // Tela de carregamento enquanto decide para onde redirecionar
  return (
    <>
      <Head>
        <title>Redirecionando... - empregoSTP</title>
      </Head>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f0f2f5'
      }}>
        <img 
          src="/assets/Emprego STP Logo (2) 1.png" 
          alt="empregoSTP" 
          style={{ 
            marginBottom: '2rem',
            maxWidth: '200px'
          }} 
        />
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #1a86ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: '1rem', color: '#4a5568' }}>Redirecionando para seu dashboard...</p>
      </div>
    </>
  );
} 