import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import RedirectGate from '../components/auth/RedirectGate';
import { useAuth } from '../context/AuthContext';
import { buildLoginUrl } from '../lib/loginRedirect';
import { requireSessionAccount } from '../lib/serverSession';

export default function PremiumRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return undefined;

    if (!user) {
      router.replace(buildLoginUrl(router.asPath));
      return undefined;
    }

    const controller = new AbortController();

    const redirectToPlans = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/profile?uid=${user.uid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          router.replace(buildLoginUrl(router.asPath));
          return;
        }

        const data = await response.json();
        const userType = data?.profile?.data?.userType;

        if (userType === 'candidato') {
          router.replace('/premium/candidatos');
          return;
        }

        if (userType === 'empresa') {
          router.replace('/premium/empresa');
          return;
        }

        if (userType === 'admin') {
          router.replace('/dashboard/admin');
          return;
        }

        router.replace(buildLoginUrl(router.asPath));
      } catch (error) {
        if (error.name !== 'AbortError')
          router.replace(buildLoginUrl(router.asPath));
      }
    };

    redirectToPlans();
    return () => controller.abort();
  }, [loading, router, user]);

  return (
    <>
      <Head>
        <title>A abrir os seus planos | EmpregoSTP</title>
      </Head>
      <RedirectGate
        title="A abrir os seus planos"
        description="Estamos a identificar o tipo de conta para mostrar as opções certas."
      />
    </>
  );
}

// Decide antes de renderizar: esta rota não precisa de aguardar o arranque
// diferido do Firebase no browser para identificar o painel da sessão.
export async function getServerSideProps(context) {
  const session = await requireSessionAccount(context);
  if (session.redirect) return session;
  const destination =
    {
      candidato: '/dashboard/candidato?tab=plans',
      empresa: '/dashboard/empresa?tab=plans',
      admin: '/dashboard/admin',
    }[session.accountType] || '/dashboard';
  return { redirect: { destination, permanent: false } };
}
