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

// O Firebase guarda o utilizador em localStorage (browserLocalPersistence).
// Quem já tem sessão no browser não pode esperar pela primeira interação: o
// cookie do servidor dura uma hora, e um clique para uma página com
// `getServerSideProps` (ex.: perfil de candidato a partir da home) chegava lá
// com o cookie expirado e era tratado como visitante.
function hasStoredFirebaseUser() {
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      if (window.localStorage.key(i)?.startsWith('firebase:authUser:')) {
        return true;
      }
    }
  } catch {
    // Sem localStorage, fica o arranque diferido.
  }
  return false;
}

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
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const deferInitialConnect = useRef(renderWhileLoading);
  const connectRef = useRef(() => {});
  const sessionRevision = useRef(0);
  const loggingOut = useRef(false);
  const retrySessionRef = useRef(() => {});
  const resetSessionRef = useRef(() => {});

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
    let currentUser = null;
    resetSessionRef.current = () => {
      currentUser = null;
      tokenSincronizado = '';
    };
    const onUserChanged = async (proximoUtilizador) => {
      if (!active || loggingOut.current) return;
      const identityChanged = currentUser?.uid !== proximoUtilizador?.uid;
      currentUser = proximoUtilizador;
      const revision = ++sessionRevision.current;
      const isCurrent = () => active && revision === sessionRevision.current;
      setUser(proximoUtilizador);
      // A renovação normal da mesma conta não desmonta formulários abertos.
      // A troca de identidade, pelo contrário, retira logo o acesso anterior.
      if (identityChanged) {
        setLoading(true);
        setSessionReady(false);
      }
      setSessionError('');

      try {
        if (proximoUtilizador) {
          const token = await proximoUtilizador.getIdToken();
          if (!isCurrent()) return;
          if (token !== tokenSincronizado) {
            await createServerSession(token);
          }
          if (!isCurrent()) return;
          tokenSincronizado = token;
        } else {
          tokenSincronizado = '';
          // Também limpa um cookie antigo quando o SDK já não tem sessão.
          // Sem Bearer, não revoga a conta que pertenceu a esse cookie.
          await destroyServerSession();
        }
        if (isCurrent()) setSessionReady(true);
      } catch (error) {
        if (!isCurrent()) return;
        tokenSincronizado = '';
        setSessionReady(false);
        setSessionError('Não foi possível validar a sessão. Tente novamente.');
      } finally {
        if (isCurrent()) setLoading(false);
      }
    };
    retrySessionRef.current = () => onUserChanged(currentUser);
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
    if (deferInitialConnect.current && hasStoredFirebaseUser()) {
      deferInitialConnect.current = false;
    }
    const cancelDeferred = deferInitialConnect.current
      ? runOnFirstInteraction(
          () => void connect(),
          whenIdle(PUBLIC_AUTH_IDLE_TIMEOUT_MS),
        )
      : () => {};
    if (!deferInitialConnect.current) void connect();
    const reconnect = () => {
      if (subscribed) void onUserChanged(currentUser);
      else void connect();
    };
    window.addEventListener('online', reconnect);
    return () => {
      active = false;
      cancelDeferred();
      unsubscribe();
      window.removeEventListener('online', reconnect);
    };
  }, []);

  // Ao passar de uma página pública para um painel, a sessão é precisa já.
  useEffect(() => {
    if (!renderWhileLoading) void connectRef.current();
  }, [renderWhileLoading]);

  const logout = async () => {
    loggingOut.current = true;
    sessionRevision.current++;
    resetSessionRef.current();
    setSessionReady(false);
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

    // O estado Firebase local é sempre encerrado, mesmo se a limpeza do
    // cookie falhar. O resultado distingue uma limpeza parcial.
    try {
      const { auth, signOut } = await import('../lib/authClientRuntime');
      await signOut(auth);
      setUser(null);
    } catch (error) {
      localError = error;
    }
    loggingOut.current = false;
    setLoading(false);
    setSessionReady(!localError && !serverError);

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
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        sessionReady,
        sessionError,
        retrySession: () => retrySessionRef.current(),
      }}
    >
      {renderWhileLoading || !loading ? children : null}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
