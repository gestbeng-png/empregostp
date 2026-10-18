import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  createServerSession,
  destroyServerSession,
} from '../lib/authSessionClient';
import { runOnFirstInteraction, whenIdle } from '../lib/runOnFirstInteraction';

// Nas páginas públicas o Firebase Auth (e, em telemóveis, o iframe do Google
// que ele arrasta) arranca na primeira interação ou quando o browser fica
// livre — fora do carregamento inicial. Painéis e autenticação arrancam logo.
const PUBLIC_AUTH_IDLE_TIMEOUT_MS = 2000;

const AuthContext = createContext();

// `renderWhileLoading` deixa as páginas públicas renderizar no servidor e no
// primeiro paint, sem esperar pelo Firebase Auth no browser. Sem isto o HTML
// de todas as rotas saía vazio (sem título, description nem `og:`), o que
// apagava o SEO e as pré-visualizações de links no WhatsApp. Quem precisa de
// saber o utilizador lê `loading`. Os dashboards e as páginas de autenticação
// continuam a esperar (valor por omissão), porque assumem o utilizador
// resolvido no primeiro render.
export function AuthProvider({ children, renderWhileLoading = false }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const deferInitialConnect = useRef(renderWhileLoading);
  const connectRef = useRef(() => {});

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
    let active = true;
    let subscribed = false;
    let connecting = false;
    let unsubscribe = () => {};
    const onUserChanged = async (proximoUtilizador) => {
      if (!active) return;
      setUser(proximoUtilizador);
      setLoading(false);

      if (!proximoUtilizador) {
        tokenSincronizado = '';
        return;
      }

      try {
        const token = await proximoUtilizador.getIdToken();
        if (!active) return;
        if (token === tokenSincronizado) return;
        tokenSincronizado = token;
        await createServerSession(token);
      } catch (error) {
        // Falhar aqui não deve deslogar ninguém: a sessão do cliente continua
        // válida e a próxima renovação do token volta a tentar.
        tokenSincronizado = '';
      }
    };
    const connect = async () => {
      if (connecting || subscribed || !active) return;
      connecting = true;
      try {
        const { auth, onIdTokenChanged } =
          await import('../lib/authClientRuntime');
        if (!active) return;
        unsubscribe = onIdTokenChanged(auth, onUserChanged);
        subscribed = true;
      } catch {
        // A missing SDK chunk is not proof that the user is anonymous. Keep
        // loading=true (private views/actions stay gated), then retry online.
      } finally {
        connecting = false;
      }
    };
    connectRef.current = connect;
    const cancelDeferred = deferInitialConnect.current
      ? runOnFirstInteraction(
          () => void connect(),
          whenIdle(PUBLIC_AUTH_IDLE_TIMEOUT_MS),
        )
      : () => {};
    if (!deferInitialConnect.current) void connect();
    window.addEventListener('online', connect);
    return () => {
      active = false;
      cancelDeferred();
      unsubscribe();
      window.removeEventListener('online', connect);
    };
  }, []);

  // Ao passar de uma página pública para um painel, a sessão é precisa já.
  useEffect(() => {
    if (!renderWhileLoading) void connectRef.current();
  }, [renderWhileLoading]);

  const logout = async () => {
    let serverError = null;
    let localError = null;

    try {
      if (typeof window !== 'undefined') {
        try {
          const { unregisterCurrentPushToken } =
            await import('../lib/webPushClient');
          await unregisterCurrentPushToken();
        } catch (error) {
          // best effort
        }

        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_AUTH_CACHES',
          });
        }
      }

      let token = '';
      try {
        const { auth } = await import('../lib/authClientRuntime');
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
      const { auth, signOut } = await import('../lib/authClientRuntime');
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
      {renderWhileLoading || !loading ? children : null}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
