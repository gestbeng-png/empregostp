import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardShell from '../../components/dashboard/DashboardShell';
import RecruitmentWorkspace from '../../components/empresa/RecruitmentWorkspace';
import { useAuth } from '../../context/AuthContext';
import { requireSessionAccount } from '../../lib/serverSession';

// A página é partilhada: a empresa dona e os membros convidados (contas de
// candidato) chegam aqui. Cada um vê a navegação do seu próprio painel, com
// «Recrutamento e equipa» ativo — nunca um menu à parte.
const PROFILE_PATH = {
  empresa: '/dashboard/empresa/profile',
  candidato: '/dashboard/candidato?tab=profile',
};
const ROLE_LABEL = {
  empresa: 'Empresa',
  candidato: 'Candidato',
  admin: 'Administrador',
};

export default function RecruitmentPage({ accountType = 'empresa' }) {
  const router = useRouter();
  const { user } = useAuth();
  const profilePath = PROFILE_PATH[accountType];
  const text = (key) =>
    typeof router.query[key] === 'string' ? router.query[key] : '';
  return (
    <>
      <Head>
        <title>Recrutamento · EmpregoSTP</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <DashboardShell
        role={accountType}
        active="recruitment"
        title="Recrutamento e equipa"
        subtitle="Candidaturas, vagas e equipa da sua organização"
        profileInTopbar={Boolean(profilePath)}
        onProfileClick={
          profilePath ? () => router.push(profilePath) : undefined
        }
        profile={{
          name:
            user?.displayName ||
            user?.email?.split('@')[0] ||
            ROLE_LABEL[accountType],
          role: ROLE_LABEL[accountType],
          avatarUrl: user?.photoURL || undefined,
        }}
      >
        <RecruitmentWorkspace
          initialOrganizationId={text('organizationId')}
          initialSection={text('section') || 'applications'}
          initialApplicationId={text('applicationId')}
          onContextChange={(query) => {
            const values = Object.fromEntries(
              Object.entries(query).filter(([, value]) => value),
            );
            void router.replace(
              { pathname: '/dashboard/recrutamento', query: values },
              undefined,
              { shallow: true },
            );
          }}
        />
      </DashboardShell>
    </>
  );
}
export async function getServerSideProps(context) {
  context.res.setHeader('Cache-Control', 'private, no-store');
  context.res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const session = await requireSessionAccount(context);
  if (session.redirect) return session;
  return { props: { accountType: session.accountType || 'candidato' } };
}
