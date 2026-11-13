import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getActionAccountType,
  getActionHref,
} from '../../lib/accountActionAccess';
import { buildLoginUrl } from '../../lib/loginRedirect';
import styles from '../../styles/AccountActionLink.module.css';

const AccountActions = createContext(null);
const ACCOUNT_LABELS = {
  empresa: 'empresa',
  candidato: 'candidato',
  admin: 'administrador',
};

// Uma leitura autenticada por página, partilhada por todos os atalhos.
// Não usa o URL, localStorage nem os privilégios de admin como prova de que
// esta sessão é do tipo exigido. Os guards do servidor continuam obrigatórios.
export function AccountActionProvider({ children }) {
  const { user, loading = true } = useAuth() || {};
  const [account, setAccount] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading || !user) return undefined;
    const controller = new AbortController();
    const load = async () => {
      setAccount(null);
      try {
        const token = await user.getIdToken();
        if (controller.signal.aborted) return;
        const response = await fetch('/api/profile', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Perfil indisponível');
        const payload = await response.json();
        const accountType = payload?.profile?.data?.userType;
        if (!['candidato', 'empresa', 'admin'].includes(accountType))
          throw new Error('Tipo de conta desconhecido');
        if (!controller.signal.aborted) {
          setAccount({
            uid: user.uid,
            accountType,
          });
        }
      } catch {
        if (!controller.signal.aborted)
          setAccount({ uid: user.uid, status: 'error' });
      }
    };
    void load();
    return () => controller.abort();
  }, [loading, user, attempt]);

  useEffect(() => {
    const retry = () => setAttempt((value) => value + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  const status = loading
    ? 'loading'
    : !user
      ? 'anonymous'
      : account?.uid === user.uid
        ? account.status === 'error'
          ? 'error'
          : 'ready'
        : 'loading';

  return (
    <AccountActions.Provider
      value={{
        status,
        accountType: account?.accountType,
      }}
    >
      {children}
    </AccountActions.Provider>
  );
}

// A shell pública partilha a mesma leitura entre conteúdo e rodapé;
// páginas que já possuem provider não fazem outra consulta ao perfil.
export function AccountActionBoundary({ children }) {
  const access = useContext(AccountActions);
  return access ? (
    children
  ) : (
    <AccountActionProvider>{children}</AccountActionProvider>
  );
}

export default function AccountActionLink({
  href,
  requiredAccountType = null,
  children,
  ...props
}) {
  const access = useContext(AccountActions);
  const required = requiredAccountType || getActionAccountType(href);
  const actionHref = getActionHref(href);
  const isRegistration = /^\/register(?:[?#]|$)/.test(actionHref);
  if (!required && !isRegistration)
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  if (!access)
    return (
      <AccountActionProvider>
        <AccountActionLink
          href={href}
          requiredAccountType={required}
          {...props}
        >
          {children}
        </AccountActionLink>
      </AccountActionProvider>
    );
  const allowed =
    Boolean(required) &&
    access.status === 'ready' &&
    access.accountType === required;
  if (access.status !== 'anonymous' && !allowed) {
    const description =
      access.status === 'loading'
        ? 'A validar o tipo de conta.'
        : access.status === 'error'
          ? 'Não foi possível validar o perfil. Recarregue a página ou volte a ligar à internet.'
          : required
            ? `Disponível apenas para contas de ${ACCOUNT_LABELS[required]}. A sua conta é de ${ACCOUNT_LABELS[access.accountType]}.`
            : 'Já tem uma conta com sessão iniciada. Não pode criar outro perfil a partir desta sessão.';
    // Um botão nativamente desativado não tem href, não entra no percurso
    // de Tab e não reage a clique, Enter, Espaço ou abertura noutra aba.
    const presentationProps = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) =>
          key === 'id' ||
          key === 'style' ||
          key.startsWith('aria-') ||
          key.startsWith('data-'),
      ),
    );
    return (
      <button
        {...presentationProps}
        type="button"
        disabled
        aria-disabled="true"
        aria-busy={access.status === 'loading' || undefined}
        className={`${props.className || ''} ${styles.disabled}`}
        title={description}
        data-required-account={required}
      >
        {children}
      </button>
    );
  }
  const isLogin = /^\/login(?:[?#]|$)/.test(actionHref);
  const destination = allowed
    ? isRegistration
      ? {
          empresa: '/dashboard/empresa/profile',
          candidato: '/dashboard/candidato?tab=profile',
          admin: '/dashboard/admin',
        }[required]
      : href
    : access.status === 'anonymous'
      ? isRegistration || isLogin
        ? href
        : buildLoginUrl(actionHref)
      : href;

  return (
    <Link {...props} href={destination} prefetch={false}>
      {children}
    </Link>
  );
}
