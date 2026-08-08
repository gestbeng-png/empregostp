import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import nookies from 'nookies';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/EscolhaTipo.module.css';

export default function EscolhaTipoPage() {
  const router = useRouter();
  const googleQuery = Array.isArray(router.query.google)
    ? router.query.google[0]
    : router.query.google;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsGoogleFlow(googleQuery === 'true');
  }, [googleQuery]);

  const handleTypeSelection = async (type) => {
    setError('');
    if (!isGoogleFlow || !user) {
      window.location.assign(`/register?type=${type}`);
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      nookies.set(null, 'token', token, {
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      });

      const response = await fetch('/api/auth/setup-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userType: type,
          fullName: user.displayName || '',
          photoUrl: user.photoURL || '',
          provider: 'google',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao configurar conta');
      }

      if (type === 'empresa') {
        window.location.href = '/dashboard/empresa';
      } else {
        window.location.href = '/dashboard/candidato';
      }
    } catch (err) {
      console.error('Erro ao atualizar tipo:', err);
      setLoading(false);
      setError('Não foi possível configurar a conta. Tente novamente.');
    }
  };

  return (
    <>
      <Head>
        <title>Escolher tipo de conta | EmpregoSTP</title>
        <meta
          name="description"
          content="Escolha entre criar uma conta como candidato ou como empregador no empregoSTP."
        />
      </Head>

      <div className={styles.page}>
        <main className={styles.main}>
          <section className={styles.card}>
            <header className={styles.banner}>
              <Link
                href="/"
                className={styles.bannerLink}
                aria-label="Voltar à página inicial"
              >
                <Image
                  src="/assets/Emprego STP Logo.png"
                  alt="EmpregoSTP"
                  width={196}
                  height={59}
                  priority
                  className={styles.bannerLogo}
                />
              </Link>
            </header>

            <div className={styles.wrapper}>
              {isGoogleFlow && user ? (
                <div className={styles.notice} role="status">
                  <strong>Conta Google ligada com sucesso.</strong>
                  <p>Escolha agora o tipo de conta para continuar.</p>
                </div>
              ) : null}

              <div className={styles.intro}>
                <h2>Escolha o seu tipo de conta</h2>
                <p>Selecione a opção certa para continuar.</p>
              </div>

              <section className={styles.grid}>
                <article className={`${styles.panel} ${styles.candidate}`}>
                  <div className={styles.visual}>
                    <Image
                      src="/assets/candidate-illustration.svg"
                      alt="Ilustração de candidato"
                      width={400}
                      height={300}
                      className={styles.visualImage}
                    />
                  </div>

                  <div className={styles.content}>
                    <div className={styles.copy}>
                      <span className={styles.kicker}>Candidato</span>
                      <h3>Candidato</h3>
                      <p>
                        Crie o seu perfil, envie o currículo e apresente
                        candidaturas às oportunidades disponíveis em São Tomé
                        e Príncipe.
                      </p>
                    </div>

                    <button
                      onClick={() => handleTypeSelection('candidato')}
                      className={styles.action}
                      disabled={loading}
                      type="button"
                    >
                      {loading ? 'A concluir…' : 'Continuar como Candidato'}
                    </button>
                  </div>
                </article>

                <article className={`${styles.panel} ${styles.employer}`}>
                  <div className={styles.visual}>
                    <Image
                      src="/assets/employer-illustration.svg"
                      alt="Ilustração de empregador"
                      width={400}
                      height={300}
                      className={styles.visualImage}
                    />
                  </div>

                  <div className={styles.content}>
                    <div className={styles.copy}>
                      <span className={styles.kicker}>Empregador</span>
                      <h3>Empregador</h3>
                      <p>
                        Crie a conta da empresa, publique vagas e encontre
                        profissionais adequados. Acompanhe o recrutamento num
                        painel dedicado.
                      </p>
                    </div>

                    <button
                      onClick={() => handleTypeSelection('empresa')}
                      className={styles.action}
                      disabled={loading}
                      type="button"
                    >
                      {loading ? 'A concluir…' : 'Continuar como Empregador'}
                    </button>
                  </div>
                </article>
              </section>

              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
