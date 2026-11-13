import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { buildLoginUrl } from '../../lib/loginRedirect';
import RedirectGate from './RedirectGate';

// Envolve TODAS as páginas de dashboard, incluindo as que têm shell própria.
// Os filhos (e os seus efeitos/formulários) só montam após validar a conta
// atual. Uma página já carregada/prefetched não é uma autorização permanente.
export default function DashboardAccessGate({
  requiredRole,
  serverUid,
  children,
}) {
  const router = useRouter();
  const { user, loading, sessionReady, sessionError, retrySession } = useAuth();
  const [access, setAccess] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const uid = user?.uid;
  const pathname = router.pathname;
  const identity = `${uid || ''}:${pathname}:${serverUid || ''}`;

  useEffect(() => {
    if (loading) return undefined;
    if (!user) {
      router.replace(buildLoginUrl(router.asPath));
      return undefined;
    }
    if (!sessionReady) return undefined;

    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted;
    const revalidate = () => {
      controller.abort();
      // Uma confirmação de rotina da mesma identidade não desmonta o
      // formulário (o seletor de ficheiros também dispara focus).
      setAttempt((value) => value + 1);
    };
    const validate = async () => {
      try {
        const token = await user.getIdToken();
        if (!isCurrent()) return;
        const response = await fetch('/api/auth/account', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        const account = await response.json();
        if (!isCurrent()) return;
        if (
          !response.ok ||
          account.uid !== uid ||
          !['admin', 'empresa', 'candidato'].includes(account.accountType)
        ) {
          throw new Error('ACCOUNT_ACCESS_DENIED');
        }
        if (account.accountType !== requiredRole) {
          // O cookie foi sincronizado antes deste ponto. Corrige o destino
          // diretamente, sem nunca montar o painel incompatível.
          setAccess(null);
          router.replace(`/dashboard/${account.accountType}`);
          return;
        }
        if (serverUid && serverUid !== uid) {
          // Mesmo papel, mas dados SSR de outra conta: recarrega pelo
          // encaminhador autenticado em vez de mostrar o perfil anterior.
          setAccess(null);
          router.replace('/dashboard');
          return;
        }
        setAccess({ identity, allowed: true });
      } catch {
        if (isCurrent()) setAccess({ identity, allowed: false });
      }
    };
    void validate();
    window.addEventListener('focus', revalidate);
    window.addEventListener('online', revalidate);
    window.addEventListener('pageshow', revalidate);
    return () => {
      controller.abort();
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('online', revalidate);
      window.removeEventListener('pageshow', revalidate);
    };
  }, [
    user,
    uid,
    loading,
    sessionReady,
    requiredRole,
    serverUid,
    identity,
    attempt,
    router,
  ]);

  if (
    !loading &&
    sessionReady &&
    access?.identity === identity &&
    access.allowed
  ) {
    // A chave elimina também estado/formulários pertencentes a outra conta.
    return <Fragment key={uid}>{children}</Fragment>;
  }

  const failed =
    !loading &&
    user &&
    ((!sessionReady && sessionError) ||
      (access?.identity === identity && !access.allowed));
  if (failed) {
    return (
      <div role="alert">
        <p>
          Não foi possível validar o acesso ao painel. Os formulários estão
          bloqueados.
        </p>
        <button
          type="button"
          onClick={() => {
            setAccess(null);
            if (!sessionReady) retrySession();
            setAttempt((value) => value + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  return (
    <RedirectGate
      title="A validar o acesso"
      description="Estamos a confirmar o painel da sua conta."
    />
  );
}
