import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  createServerSession,
  destroyServerSession,
} from '../lib/authSessionClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // O cookie `token` que as páginas protegidas lêem no servidor é o próprio
  // ID token do Firebase e por isso expira ao fim de uma hora. O SDK renova o
  // token sozinho (e restaura a sessão guardada quando o browser reabre), mas
  // ninguém reescrevia o cookie: passada a hora, todas as rotas com
  // `getServerSideProps` mandavam para o login outra vez.
  //
  // `onIdTokenChanged` dispara no arranque, em cada renovação e no logout —
  // é o gancho certo para manter o cookie a par do token.
  useEffect(() => {
    let tokenSincronizado = '';

    const unsubscribe = onIdTokenChanged(auth, async (proximoUtilizador) => {
      setUser(proximoUtilizador);
      setLoading(false);

      if (!proximoUtilizador) {
        tokenSincronizado = '';
        return;
      }

      try {
        const token = await proximoUtilizador.getIdToken();
        if (token === tokenSincronizado) return;
        tokenSincronizado = token;
        await createServerSession(token);
      } catch (error) {
        // Falhar aqui não deve deslogar ninguém: a sessão do cliente continua
        // válida e a próxima renovação do token volta a tentar.
        tokenSincronizado = '';
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    let serverError = null;
    let localError = null;

    try {
      if (typeof window !== 'undefined') {
        try {
          const { unregisterCurrentPushToken } = await import('../lib/webPushClient');
          await unregisterCurrentPushToken();
        } catch (error) {
          // best effort
        }

        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_AUTH_CACHES' });
        }
      }

      let token = '';
      try {
        token = (await auth.currentUser?.getIdToken()) || '';
      } catch (error) {
        // O DELETE continua útil para expirar o cookie mesmo sem token válido.
      }

      try {
        await destroyServerSession(token);
      } catch (error) {
        serverError = error;
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      serverError = error;
    }

    // O estado Firebase local é sempre encerrado, mesmo se a revogação ou o
    // pedido ao servidor falhar. O resultado distingue uma limpeza parcial.
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      localError = error;
    }

    const error = localError || serverError;
    if (error) {
      console.error('Erro ao fazer logout:', error);
      return {
        success: false,
        localSignedOut: !localError,
        serverSessionCleared: !serverError,
        error: error.message,
      };
    }

    return {
      success: true,
      localSignedOut: true,
      serverSessionCleared: true,
    };
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
