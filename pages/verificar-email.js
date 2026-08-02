import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { applyActionCode } from 'firebase/auth';
import { FiAlertCircle, FiCheckCircle, FiClock } from 'react-icons/fi';
import auth from '../lib/firebaseAuth';
import AuthShell from '../components/auth/AuthShell';
import styles from '../styles/AuthPage.module.css';

export default function VerificarEmail() {
  const router = useRouter();
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  useEffect(() => {
    if (!router.isReady) return;

    const oobCode = Array.isArray(router.query.oobCode)
      ? router.query.oobCode[0]
      : router.query.oobCode;

    if (!oobCode) {
      setStatus('error');
      return;
    }

    let active = true;
    applyActionCode(auth, oobCode)
      .then(() => {
        if (active) setStatus('success');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [router.isReady, router.query.oobCode]);

  return (
    <>
      <Head>
        <title>Confirmar email | EmpregoSTP</title>
      </Head>

      <AuthShell minimal>
        <div className={styles.verifyScreen}>
          {status === 'verifying' ? (
            <div
              className={styles.verifyState}
              role="status"
              aria-live="polite"
            >
              <FiClock className={styles.verifyIcon} aria-hidden="true" />
              <h1 className={styles.verifyTitle}>A confirmar o seu email</h1>
              <p className={styles.verifyText}>Aguarde um instante.</p>
            </div>
          ) : null}

          {status === 'success' ? (
            <div
              className={styles.verifyState}
              role="status"
              aria-live="polite"
            >
              <FiCheckCircle className={styles.verifyIcon} aria-hidden="true" />
              <h1 className={styles.verifyTitle}>Email confirmado</h1>
              <p className={styles.verifyText}>
                A sua conta foi ativada com sucesso. Já pode entrar e começar a
                usar o EmpregoSTP.
              </p>
              <Link href="/login" className={styles.primaryButton}>
                Iniciar sessão
              </Link>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className={styles.verifyState} role="alert">
              <FiAlertCircle className={styles.verifyIcon} aria-hidden="true" />
              <h1 className={styles.verifyTitle}>Link inválido ou expirado</h1>
              <p className={styles.verifyText}>
                Este link de confirmação já foi usado ou expirou. Inicie sessão
                para pedir um novo email de confirmação.
              </p>
              <Link href="/login" className={styles.primaryButton}>
                Iniciar sessão
              </Link>
            </div>
          ) : null}
        </div>
      </AuthShell>
    </>
  );
}
