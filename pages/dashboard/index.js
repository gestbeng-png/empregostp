import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../context/AuthContext';
import RedirectGate from '../../components/auth/RedirectGate';
import { buildLoginUrl } from '../../lib/loginRedirect';
import { requireSessionAccount } from '../../lib/serverSession';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    async function redirectUser() {
      if (!user) {
        router.replace(buildLoginUrl(router.asPath));
        return;
      }

      try {
        // O perfil é lido pela API autenticada. Além de centralizar a
        // autorização, evita misturar instâncias/SDKs Firestore client-side
        // nesta rota de redirecionamento.
        // A rota exige o token no cabeçalho; sem ele respondia 401 e todas
        // as contas acabavam na página inicial.
        const token = await user.getIdToken();
        if (controller.signal.aborted) return;
        const response = await fetch(
          `/api/profile?uid=${encodeURIComponent(user.uid)}`,
          {
            cache: 'no-store',
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const payload = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (
          (response.ok || response.status === 304) &&
          payload?.profile?.data
        ) {
          const userType = payload.profile.data.userType;

          if (userType === 'empresa') {
            router.replace('/dashboard/empresa');
          } else if (userType === 'candidato') {
            router.replace('/dashboard/candidato');
          } else if (userType === 'admin') {
            router.replace('/dashboard/admin');
          } else {
            console.error('Tipo de utilizador desconhecido:', userType);
            router.replace('/');
          }
        } else {
          console.error('Utilizador não encontrado no perfil autenticado');
          router.replace('/');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Não foi possível consultar o utilizador:', error);
        router.replace('/');
      }
    }

    if (!loading) {
      redirectUser();
    }
    return () => controller.abort();
  }, [user, loading, router]);

  return (
    <>
      <Head>
        <title>A abrir o seu painel | EmpregoSTP</title>
      </Head>
      <RedirectGate
        title="A abrir o seu painel"
        description="Estamos a encaminhar a sua sessão para o espaço certo."
      />
    </>
  );
}

// Alinha esta rota com os dashboards de empresa e admin, que já bloqueavam no
// servidor: sem sessão, o utilizador deixa de ver a shell antes de ser
// redirecionado, e o destino pretendido é preservado.
// Com sessão válida, o encaminhamento acontece já no servidor (o tipo de conta
// é lido na mesma leitura do guard); o efeito acima fica como reserva.
export async function getServerSideProps(context) {
  const session = await requireSessionAccount(context);
  if (session.redirect) return session;
  if (session.accountType) {
    return {
      redirect: {
        destination: `/dashboard/${session.accountType}`,
        permanent: false,
      },
    };
  }
  return { props: {} };
}
