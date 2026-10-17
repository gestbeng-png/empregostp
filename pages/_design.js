import Head from 'next/head';
import DashboardShell from '../components/dashboard/DashboardShell';
import DesignGallery from '../components/design/DesignGallery';
import { requireAdminPageAuth } from '../lib/adminPageGuard';

export default function DesignPage() {
  return (
    <>
      <Head>
        <title>Galeria interna · EmpregoSTP</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <DashboardShell
        role="admin"
        title="Galeria de componentes"
        subtitle="Referência interna · sem alterações aos estilos existentes"
      >
        <DesignGallery />
      </DashboardShell>
    </>
  );
}

export async function getServerSideProps(context) {
  context.res.setHeader('Cache-Control', 'private, no-store');
  context.res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const result = await requireAdminPageAuth(context);
  if (!result.ok) return { redirect: result.redirect };
  // Never serialize the admin's account, token or customer data into the page.
  return { props: {} };
}
