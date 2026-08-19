import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { destroyServerSession } from '../lib/authSessionClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
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
