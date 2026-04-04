import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import nookies from 'nookies';
import auth from '../lib/firebaseAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { redirect } = router.query;

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Verificar se usuário existe no Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const token = await user.getIdToken();

      nookies.set(null, 'token', token, {
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      });
      
      if (!userDoc.exists()) {
        window.location.href = '/escolha-tipo?google=true';
        return;
      }
      
      const userData = userDoc.data();
      
      // Se ainda precisa escolher tipo
      if (userData.needsTypeSelection) {
        window.location.href = '/escolha-tipo?google=true';
        return;
      }
      
      const userType = userData.userType;
      
      // Redirecionar
      if (redirect) {
        window.location.href = redirect;
      } else if (userType === 'empresa') {
        window.location.href = '/dashboard/empresa';
      } else if (userType === 'admin') {
        window.location.href = '/dashboard/admin';
      } else {
        window.location.href = '/dashboard/candidato';
      }
      
    } catch (err) {
      console.error('Erro ao fazer login com Google:', err);
      setLoading(false);
      
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelado.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup bloqueado. Habilite popups para este site.');
      } else {
        setError('Erro ao fazer login com Google. Tente novamente.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('E-mail e senha são obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const token = await user.getIdToken();
      nookies.set(null, 'token', token, {
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      });
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        await auth.signOut();
        setError('Usuário não encontrado. Complete seu cadastro.');
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      const userType = userData.userType;
      
      if (redirect) {
        window.location.href = redirect;
      } else if (userType === 'empresa') {
        window.location.href = '/dashboard/empresa';
      } else if (userType === 'admin') {
        window.location.href = '/dashboard/admin';
      } else {
        window.location.href = '/dashboard/candidato';
      }
    } catch (err) {
      setLoading(false);
      
      if (
        err.code === 'auth/invalid-email' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    }
  };

  return (
    <>
      <Head>
        <title>Login - EmpregoSTP</title>
      </Head>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 50%, #252b47 100%)',
        padding: '2rem 1rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Efeito decorativo 1 */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          pointerEvents: 'none'
        }}></div>

        {/* Efeito decorativo 2 */}
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          left: '10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          pointerEvents: 'none'
        }}></div>

        {/* Card principal */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '3rem',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          width: '100%',
          maxWidth: '480px',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img 
              src="/assets/Emprego STP Logo (2) 1.png" 
              alt="EmpregoSTP" 
              style={{
                maxWidth: '220px',
                height: 'auto',
                filter: 'drop-shadow(0 4px 15px rgba(59, 130, 246, 0.3))'
              }}
            />
          </div>

          <form onSubmit={handleSubmit}>
            {/* Título */}
            <h2 style={{
              textAlign: 'center',
              color: 'white',
              marginBottom: '0.75rem',
              fontSize: '2rem',
              fontWeight: '900',
              letterSpacing: '-0.02em'
            }}>
              Faça seu Login
            </h2>

            <p style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '2.5rem',
              fontSize: '1rem',
              lineHeight: 1.6
            }}>
              Entre com seu e-mail e senha para continuar
            </p>
            
            {/* Email */}
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#60a5fa';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(96, 165, 250, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Senha */}
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#60a5fa';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(96, 165, 250, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div style={{
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
            
            {/* Botão Entrar */}
            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                background: loading ? 'rgba(59, 130, 246, 0.5)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1.05rem',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
                marginBottom: '1.5rem'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.4)';
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            {/* Divisor */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '1.5rem 0',
              gap: '1rem'
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', fontWeight: '600' }}>OU</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
            </div>

            {/* Botão Google */}
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'white',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                transition: 'all 0.3s ease',
                color: '#2d3748'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#f7fafc';
                  e.currentTarget.style.borderColor = '#cbd5e0';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Autenticando...' : 'Continuar com Google'}
            </button>
          </form>

          {/* Link para Registro */}
          <p style={{
            textAlign: 'center',
            marginTop: '2rem',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.95rem'
          }}>
            Não tem uma conta?{' '}
            <Link href="/register" style={{
              color: '#60a5fa',
              fontWeight: '700',
              textDecoration: 'none',
              transition: 'color 0.3s ease'
            }}>
              Crie uma aqui
            </Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </>
  );
}
