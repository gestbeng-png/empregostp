import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import nookies from 'nookies';
import LandingHeader from '../components/LandingHeader';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/EscolhaTipo.module.css';

export default function EscolhaTipoPage() {
  const router = useRouter();
  const { google } = router.query;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);

  useEffect(() => {
    setIsGoogleFlow(google === 'true');
  }, [google]);

  const handleTypeSelection = async (type) => {
    if (!isGoogleFlow || !user) {
      // Fluxo normal - redireciona para registro
      router.push(`/register?type=${type}`);
      return;
    }

    // Fluxo Google - configurar userType/plano via backend e redirecionar
    setLoading(true);
    try {
      const token = await user.getIdToken();
      nookies.set(null, 'token', token, {
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      });

      const response = await fetch('/api/auth/setup-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userType: type,
          fullName: user.displayName || '',
          photoUrl: user.photoURL || '',
          provider: 'google'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao configurar conta');
      }

      // Redirecionar baseado no tipo
      if (type === 'empresa') {
        window.location.href = '/dashboard/empresa';
      } else {
        window.location.href = '/dashboard/candidato';
      }
    } catch (err) {
      console.error('Erro ao atualizar tipo:', err);
      setLoading(false);
      alert('Erro ao configurar conta. Tente novamente.');
    }
  };

  return (
    <>
      <Head>
        <title>Escolha seu tipo de conta - empregoSTP</title>
        <meta name="description" content="Escolha entre criar uma conta como candidato ou como empregador no empregoSTP." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.page}>
        <LandingHeader />

        <main className={styles.main}>
          {isGoogleFlow && user && (
            <div className={styles.notice}>
              <h3>Conta Google conectada com sucesso</h3>
              <p>
                Agora escolha o tipo de conta para continuar
              </p>
            </div>
          )}

          <section className={styles.grid}>
            <div className={`${styles.panel} ${styles.candidate}`}>
              <div className={styles.content}>
                <h2>Ser um Candidato</h2>
                <p>Crie seu perfil, envie seu currículo e candidate-se às melhores vagas disponíveis em São Tomé e Príncipe. Encontre a oportunidade perfeita para sua carreira.</p>
                <button 
                  onClick={() => handleTypeSelection('candidato')}
                  className={styles.action}
                  disabled={loading}
                >
                  {loading ? 'Aguarde...' : 'INSCREVER-SE'}
                </button>
              </div>
            </div>
            <div className={`${styles.panel} ${styles.employer}`}>
              <div className={styles.content}>
                <h2>Ser um Empregador</h2>
                <p>Crie sua conta empresarial, publique vagas e encontre os melhores talentos para sua empresa. Simplifique seu processo de recrutamento e seleção.</p>
                <button 
                  onClick={() => handleTypeSelection('empresa')}
                  className={styles.action}
                  disabled={loading}
                >
                  {loading ? 'Aguarde...' : 'CRIAR CONTA'}
                </button>
              </div>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <p>&copy; {new Date().getFullYear()} empregoSTP. Todos os direitos reservados.</p>
        </footer>
      </div>
    </>
  );
}
