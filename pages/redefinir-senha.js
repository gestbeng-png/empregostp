import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiCircle,
  FiClock,
} from 'react-icons/fi';
import auth from '../lib/firebaseAuth';
import AuthShell from '../components/auth/AuthShell';
import { getPasswordChecks, isStrongPassword } from '../lib/validation';
import styles from '../styles/AuthPage.module.css';

export default function RedefinirSenha() {
  const router = useRouter();
  // checking | ready | invalid | done
  const [status, setStatus] = useState('checking');
  const [accountEmail, setAccountEmail] = useState('');
  const [oobCode, setOobCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordChecks = getPasswordChecks(password);
  const passwordRules = [
    { key: 'length', label: 'Mínimo de 8 caracteres' },
    { key: 'uppercase', label: 'Uma letra maiúscula' },
    { key: 'lowercase', label: 'Uma letra minúscula' },
    { key: 'number', label: 'Um número' },
    { key: 'special', label: 'Um símbolo especial' },
  ];

  useEffect(() => {
    if (!router.isReady) return;

    const code = Array.isArray(router.query.oobCode)
      ? router.query.oobCode[0]
      : router.query.oobCode;

    if (!code) {
      setStatus('invalid');
      return;
    }

    let active = true;
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        if (!active) return;
        setAccountEmail(email);
        setOobCode(code);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('invalid');
      });

    return () => {
      active = false;
    };
  }, [router.isReady, router.query.oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isStrongPassword(password)) {
      setError(
        'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo especial.',
      );
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('done');
    } catch (err) {
      if (err.code === 'auth/weak-password') {
        setError(
          'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo especial.',
        );
      } else if (
        err.code === 'auth/expired-action-code' ||
        err.code === 'auth/invalid-action-code'
      ) {
        setStatus('invalid');
      } else {
        setError('Não foi possível redefinir a senha. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Redefinir senha | EmpregoSTP</title>
      </Head>

      <AuthShell minimal>
        {status === 'checking' ? (
          <div className={styles.verifyScreen} role="status" aria-live="polite">
            <FiClock className={styles.verifyIcon} aria-hidden="true" />
            <h1 className={styles.verifyTitle}>A validar o link</h1>
            <p className={styles.verifyText}>Aguarde um instante.</p>
          </div>
        ) : null}

        {status === 'invalid' ? (
          <div className={styles.verifyScreen} role="alert">
            <FiAlertCircle className={styles.verifyIcon} aria-hidden="true" />
            <h1 className={styles.verifyTitle}>Link inválido ou expirado</h1>
            <p className={styles.verifyText}>
              Este link de recuperação já foi usado ou expirou. Peça um novo
              link para redefinir a sua senha.
            </p>
            <Link href="/recuperar-senha" className={styles.primaryButton}>
              Pedir novo link
            </Link>
          </div>
        ) : null}

        {status === 'done' ? (
          <div className={styles.verifyScreen} role="status" aria-live="polite">
            <FiCheckCircle className={styles.verifyIcon} aria-hidden="true" />
            <h1 className={styles.verifyTitle}>Senha alterada</h1>
            <p className={styles.verifyText}>
              A sua senha foi alterada com sucesso. Já pode entrar com a nova
              senha.
            </p>
            <Link href="/login" className={styles.primaryButton}>
              Iniciar sessão
            </Link>
          </div>
        ) : null}

        {status === 'ready' ? (
          <>
            <div className={styles.formHeader}>
              <h1>Criar nova senha</h1>
              <p>
                Defina uma nova senha para <strong>{accountEmail}</strong>.
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="new-password" className={styles.fieldLabel}>
                  Nova senha
                </label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="Crie uma senha forte"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  autoComplete="new-password"
                  aria-describedby="reset-password-requirements"
                  className={styles.input}
                />
                {passwordFocused || password.length > 0 ? (
                  <ul
                    id="reset-password-requirements"
                    className={styles.passwordRules}
                    aria-live="polite"
                  >
                    {passwordRules.map((rule) => {
                      const met = passwordChecks[rule.key];
                      return (
                        <li
                          key={rule.key}
                          className={`${styles.passwordRule} ${
                            met ? styles.passwordRuleMet : ''
                          }`}
                        >
                          <span
                            className={styles.passwordRuleIcon}
                            aria-hidden="true"
                          >
                            {met ? <FiCheck /> : <FiCircle />}
                          </span>
                          <span>{rule.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div className={styles.field}>
                <label htmlFor="confirm-password" className={styles.fieldLabel}>
                  Confirmar nova senha
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
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
                disabled={saving}
                className={styles.primaryButton}
              >
                {saving ? 'A guardar…' : 'Redefinir senha'}
              </button>
            </form>
          </>
        ) : null}
      </AuthShell>
    </>
  );
}
