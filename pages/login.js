import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import nookies from "nookies";
import { doc, getDoc } from "firebase/firestore";
import auth from "../lib/firebaseAuth";
import { db } from "../lib/firebase";
import AuthShell from "../components/auth/AuthShell";
import styles from "../styles/AuthPage.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const redirect = Array.isArray(router.query.redirect)
    ? router.query.redirect[0]
    : router.query.redirect;

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const token = await user.getIdToken();

      nookies.set(null, "token", token, {
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });

      if (!userDoc.exists()) {
        window.location.href = "/escolha-tipo?google=true";
        return;
      }

      const userData = userDoc.data();

      if (userData.needsTypeSelection) {
        window.location.href = "/escolha-tipo?google=true";
        return;
      }

      const userType = userData.userType;

      if (redirect) {
        window.location.href = redirect;
      } else if (userType === "empresa") {
        window.location.href = "/dashboard/empresa";
      } else if (userType === "admin") {
        window.location.href = "/dashboard/admin";
      } else {
        window.location.href = "/dashboard/candidato";
      }
    } catch (err) {
      console.error("Erro ao fazer login com Google:", err);
      setLoading(false);

      if (err.code === "auth/popup-closed-by-user") {
        setError("Login cancelado.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup bloqueado. Habilite popups para este site.");
      } else {
        setError("Erro ao fazer login com Google. Tente novamente.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("E-mail e senha são obrigatórios.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      const token = await user.getIdToken();
      nookies.set(null, "token", token, {
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });

      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists()) {
        await auth.signOut();
        setError("Usuário não encontrado. Complete seu cadastro.");
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const userType = userData.userType;

      if (redirect) {
        window.location.href = redirect;
      } else if (userType === "empresa") {
        window.location.href = "/dashboard/empresa";
      } else if (userType === "admin") {
        window.location.href = "/dashboard/admin";
      } else {
        window.location.href = "/dashboard/candidato";
      }
    } catch (err) {
      setLoading(false);

      if (
        err.code === "auth/invalid-email" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Muitas tentativas. Tente novamente mais tarde.");
      } else {
        setError("Erro ao fazer login. Tente novamente.");
      }
    }
  };

  return (
    <>
      <Head>
        <title>Login - EmpregoSTP</title>
      </Head>

      <AuthShell minimal>
        <div className={styles.formHeader}>
          <h2>Faça seu Login</h2>
          <p>Entre com seu e-mail e senha para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="login-email" className={styles.fieldLabel}>
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="login-password" className={styles.fieldLabel}>
              Senha
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={styles.input}
            />
          </div>

          {error ? (
            <div className={styles.error} role="alert" aria-live="polite">
              <span className={styles.errorIcon}>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={styles.primaryButton}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerLine} />
          <span>Ou</span>
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
          {loading ? "Autenticando..." : "Continuar com Google"}
        </button>

        <p className={styles.footerNote}>
          Não tem uma conta?{" "}
          <Link href="/register" className={styles.footerLink}>
            Crie uma aqui
          </Link>
        </p>
      </AuthShell>
    </>
  );
}
