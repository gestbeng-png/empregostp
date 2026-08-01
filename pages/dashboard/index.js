import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import RedirectGate from '../../components/auth/RedirectGate';
import { buildLoginUrl } from '../../lib/loginRedirect';
import { requireSession } from '../../lib/serverSession';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    async function redirectUser() {
      if (!user) {
        router.replace(buildLoginUrl(router.asPath));
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const userType = userData.userType;

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
          console.error('Utilizador não encontrado no Firestore');
          router.replace('/');
        }
      } catch (error) {
        console.error('Não foi possível consultar o utilizador:', error);
        router.replace('/');
      }
    }

    if (!loading) {
      redirectUser();
    }
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
export async function getServerSideProps(context) {
  const guard = await requireSession(context);
  if (guard) return guard;
  return { props: {} };
}
