import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import RedirectGate from '../components/auth/RedirectGate';
import { useAuth } from '../context/AuthContext';
import { normalizeUserType } from '../lib/defaultPlans';
import { buildLoginUrl } from '../lib/loginRedirect';

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
        const userType = normalizeUserType(data?.profile?.data?.userType);

        if (userType === 'candidato') {
          router.replace('/premium/candidatos');
          return;
        }

        if (userType === 'empresa') {
          router.replace('/premium/empresa');
          return;
        }

        router.replace(buildLoginUrl(router.asPath));
      } catch (error) {
        if (error.name !== 'AbortError') router.replace(buildLoginUrl(router.asPath));
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
