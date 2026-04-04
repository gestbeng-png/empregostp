import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Head from 'next/head';

export default function ProfileRedirect() {
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
            router.push('/dashboard/empresa/profile');
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
        <title>Redirecionando - EmpregoSTP</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%)'
      }}>
        <img 
          src="/assets/Emprego STP Logo (2) 1.png" 
          alt="EmpregoSTP" 
          style={{ 
            marginBottom: '3rem',
            maxWidth: '220px',
            filter: 'drop-shadow(0 4px 15px rgba(59, 130, 246, 0.3))'
          }} 
        />
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255, 255, 255, 0.1)',
          borderTop: '4px solid #60a5fa',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: '1.5rem', color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.05rem', fontWeight: '600' }}>
          Redirecionando para seu perfil...
        </p>
      </div>
    </>
  );
} 
