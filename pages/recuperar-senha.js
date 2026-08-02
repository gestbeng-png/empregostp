import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { FiAlertCircle, FiMail } from 'react-icons/fi';
import AuthShell from '../components/auth/AuthShell';
import { isValidEmail, normalizeEmail } from '../lib/validation';
import styles from '../styles/AuthPage.module.css';

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Introduza o seu email.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Introduza um email válido.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });

      if (response.ok) {
        // Mostramos sempre sucesso (mesmo que o email não exista) para não
        // revelar quais emails estão registados — boa prática de segurança.
        setSent(true);
      } else if (response.status === 400) {
        setError('Introduza um email válido.');
      } else {
        setError(
          'Não foi possível enviar o email de recuperação. Tente novamente.',
        );
      }
    } catch (err) {
      setError(
        'Não foi possível enviar o email de recuperação. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Recuperar senha | EmpregoSTP</title>
      </Head>

      <AuthShell minimal>
        {sent ? (
          <div className={styles.verifyScreen} role="status" aria-live="polite">
            <FiMail className={styles.verifyIcon} aria-hidden="true" />
            <h1 className={styles.verifyTitle}>Verifique o seu email</h1>
            <p className={styles.verifyText}>
              Se existir uma conta associada a{' '}
              <strong>{normalizeEmail(email)}</strong>, enviámos um link para
              redefinir a sua senha. Abra o email e siga as instruções.
            </p>
            <Link href="/login" className={styles.primaryButton}>
              Voltar ao início de sessão
            </Link>
            <button
              type="button"
              onClick={() => setSent(false)}
              className={styles.linkButton}
            >
              Usar outro email
            </button>
          </div>
        ) : (
          <>
            <div className={styles.formHeader}>
              <h1>Recuperar senha</h1>
              <p>
                Introduza o seu email e enviaremos um link para redefinir a sua
                senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="recover-email" className={styles.fieldLabel}>
                  Email
                </label>
                <input
                  id="recover-email"
                  type="email"
                  placeholder="O seu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={styles.input}
                />
              </div>

              {error ? (
                <div className={styles.error} role="alert" aria-live="polite">
                  <FiAlertCircle
                    className={styles.errorIcon}
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={styles.primaryButton}
              >
                {loading ? 'A enviar…' : 'Enviar link de recuperação'}
              </button>
            </form>

            <p className={styles.footerNote}>
              Já se lembra da senha?{' '}
              <Link href="/login" className={styles.footerLink}>
                Iniciar sessão
              </Link>
            </p>
          </>
        )}
      </AuthShell>
    </>
  );
}
