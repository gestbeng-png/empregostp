import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  onIdTokenChanged,
  GoogleAuthProvider,
} from 'firebase/auth';
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { doc, getDoc } from 'firebase/firestore';
import auth from '../lib/firebaseAuth';
import { db } from '../lib/firebase';
import AuthShell from '../components/auth/AuthShell';
import { isValidEmail, normalizeEmail } from '../lib/validation';
import { sanitizeLoginRedirect } from '../lib/loginRedirect';
import { isNetworkError, OFFLINE_MESSAGE } from '../lib/networkError';
import {
  createServerSession,
  destroyServerSession,
} from '../lib/authSessionClient';
import {
  BLOCKED_ACCOUNT_MESSAGE,
  isUserAccountActive,
} from '../lib/userStatus';
import styles from '../styles/AuthPage.module.css';

// Só uma tentativa de retoma automática por período curto: se o destino nos
// devolver ao login (cookies bloqueados, relógio adiantado), o formulário
// aparece em vez de o browser entrar num ciclo de recarregamentos.
const RETOMA_CHAVE = 'empregostp:retoma-sessao';
const RETOMA_INTERVALO_MS = 30_000;

function podeRetomarSessao() {
  try {
    const ultima = Number(window.sessionStorage.getItem(RETOMA_CHAVE) || 0);
    return !ultima || Date.now() - ultima > RETOMA_INTERVALO_MS;
  } catch {
    // Sem sessionStorage não há como travar o ciclo: não arriscamos.
    return false;
  }
}

function marcarRetomaSessao() {
  try {
    window.sessionStorage.setItem(RETOMA_CHAVE, String(Date.now()));
  } catch {
    // Ignorado: a retoma segue à mesma, só fica sem travão.
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const requestedRedirect = Array.isArray(router.query.redirect)
    ? router.query.redirect[0]
    : router.query.redirect;
  const redirect = sanitizeLoginRedirect(requestedRedirect);

  // Quem já tem sessão guardada no browser não devia ter de a escrever outra
  // vez: o cookie do servidor expirou, mas o Firebase ainda tem o utilizador.
  // Recriamos a sessão e seguimos para o destino pedido.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (utilizadorAtual) => {
      if (!utilizadorAtual || !podeRetomarSessao()) return;

      try {
        const token = await utilizadorAtual.getIdToken();
        await createServerSession(token);
        marcarRetomaSessao();
        // O cookie já está escrito: o `getServerSideProps` do destino corre
        // com a sessão válida, por isso basta navegar.
        router.replace(redirect || '/dashboard');
      } catch (err) {
        // Conta bloqueada ou token recusado: fica o formulário.
      }
    });

    return () => unsubscribe();
  }, [redirect, router]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await destroyServerSession().catch(() => undefined);
        window.location.href = '/register?google=true';
        return;
      }

      const userData = userDoc.data();

      if (userData.needsTypeSelection) {
        await destroyServerSession().catch(() => undefined);
        window.location.href = '/register?google=true';
        return;
      }

      if (!isUserAccountActive(userData)) {
        await Promise.allSettled([auth.signOut(), destroyServerSession()]);
        setError(BLOCKED_ACCOUNT_MESSAGE);
        setLoading(false);
        return;
      }

      const userType = userData.userType;
      const token = await user.getIdToken();
      await createServerSession(token);

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
      console.error('Erro ao iniciar sessão com Google:', err);
      if (err.code === 'ACCOUNT_BLOCKED') {
        await Promise.allSettled([auth.signOut(), destroyServerSession()]);
      }
      setLoading(false);

      if (isNetworkError(err)) {
        setError(OFFLINE_MESSAGE);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Início de sessão cancelado.');
      } else if (err.code === 'auth/popup-blocked') {
        setError(
          'A janela de autenticação foi bloqueada. Autorize janelas adicionais para este site.',
        );
      } else if (
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/operation-not-allowed'
      ) {
        setError(
          'O login com Google está temporariamente indisponível neste domínio. Por favor use o email e a senha, ou tente novamente mais tarde.',
        );
      } else if (err.code === 'ACCOUNT_BLOCKED') {
        setError(BLOCKED_ACCOUNT_MESSAGE);
      } else {
        setError(
          'Não foi possível iniciar sessão com o Google. Tente novamente.',
        );
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setNeedsVerification(false);

    if (!email || !password) {
      setError('O email e a senha são obrigatórios.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Introduza um email válido.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        normalizeEmail(email),
        password,
      );
      const user = userCredential.user;

      // Bloquear acesso enquanto o email não estiver confirmado.
      if (!user.emailVerified) {
        await Promise.allSettled([auth.signOut(), destroyServerSession()]);
        setNeedsVerification(true);
        setError(
          'Confirme o seu email antes de iniciar sessão. Verifique a caixa de entrada e a pasta de spam.',
        );
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        await Promise.allSettled([auth.signOut(), destroyServerSession()]);
        setError('Utilizador não encontrado. Conclua o seu registo.');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      if (!isUserAccountActive(userData)) {
        await Promise.allSettled([auth.signOut(), destroyServerSession()]);
        setError(BLOCKED_ACCOUNT_MESSAGE);
        setLoading(false);
        return;
      }

      const userType = userData.userType;
      const token = await user.getIdToken();
      await createServerSession(token);

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

      if (isNetworkError(err)) {
        setError(OFFLINE_MESSAGE);
      } else if (err.code === 'ACCOUNT_BLOCKED') {
        await Promise.allSettled([auth.signOut(), destroyServerSession()]);
        setError(BLOCKED_ACCOUNT_MESSAGE);
      } else if (
        err.code === 'auth/invalid-email' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Email ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Não foi possível iniciar sessão. Tente novamente.');
      }
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setInfo('');
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        normalizeEmail(email),
        password,
      );
      const token = await credential.user.getIdToken();
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: credential.user.displayName || '' }),
      });
      await auth.signOut();
      if (!response.ok) throw new Error('resend_failed');
      setError('');
      setInfo(
        'Email de confirmação reenviado. Verifique a sua caixa de entrada.',
      );
    } catch (err) {
      if (isNetworkError(err)) {
        setError(OFFLINE_MESSAGE);
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitos pedidos. Aguarde alguns minutos e tente novamente.');
      } else {
        setError('Não foi possível reenviar. Confirme o email e a senha.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Head>
        <title>Iniciar sessão | EmpregoSTP</title>
      </Head>

      <AuthShell minimal>
        <div className={styles.formHeader}>
          <h1>Iniciar sessão</h1>
          <p>Use o seu email e a sua senha para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="login-email" className={styles.fieldLabel}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="O seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="login-password" className={styles.fieldLabel}>
                Senha
              </label>
              <Link href="/recuperar-senha" className={styles.forgotLink}>
                Recuperar senha
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              placeholder="A sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={styles.input}
            />
          </div>

          {info ? (
            <div className={styles.info} role="status" aria-live="polite">
              <FiCheckCircle className={styles.errorIcon} aria-hidden="true" />
              <span>{info}</span>
            </div>
          ) : null}

          {error ? (
            <div className={styles.error} role="alert" aria-live="polite">
              <FiAlertCircle className={styles.errorIcon} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {needsVerification ? (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className={styles.linkButton}
            >
              {resending ? 'A reenviar…' : 'Reenviar email de confirmação'}
            </button>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={styles.primaryButton}
          >
            {loading ? 'A iniciar sessão…' : 'Iniciar sessão'}
          </button>
        </form>

        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerLine} />
          <span>ou</span>
          <span className={styles.dividerLine} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className={styles.socialButton}
        >
          <svg
            className={styles.socialIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? 'A autenticar…' : 'Continuar com Google'}
        </button>

        <p className={styles.footerNote}>
          Ainda não tem uma conta?{' '}
          <Link href="/register" className={styles.footerLink}>
            Criar conta
          </Link>
        </p>
      </AuthShell>
    </>
  );
}
