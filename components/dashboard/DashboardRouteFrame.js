import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';

// A shell só é usada nas rotas de dashboard, mas este frame envolve todas as
// páginas a partir do _app — sem divisão de código, cada página pública
// descarregava a sidebar, a topbar e os respetivos ícones sem os usar.
// O SSR é mantido para o dashboard continuar a renderizar no servidor.
const DashboardShell = dynamic(() => import('./DashboardShell'));

const SELF_CONTAINED_ROUTES = new Set([
  '/dashboard/admin',
  '/dashboard/candidato',
  '/dashboard/empresa',
  '/dashboard/empresa/profile',
  '/dashboard/empresa/vaga/[id]',
  '/dashboard/empresa/vaga/criar-vaga',
]);

const ADMIN_ROUTE_META = {
  affiliates: ['affiliates', 'Afiliados'],
  auditoria: ['audit', 'Auditoria'],
  blog: ['blog', 'Conteúdo do blog'],
  'hr-services': ['hr-services', 'Serviços de RH'],
  jobs: ['jobs', 'Gestão de vagas'],
  news: ['news', 'Notícias'],
  'payment-settings': ['payments', 'Configuração de pagamentos'],
  plans: ['plans', 'Planos'],
  reports: ['reports', 'Relatórios'],
  resources: ['resources', 'Recursos'],
  services: ['services', 'Serviços'],
  'subscription-requests': ['subscriptions', 'Solicitações de subscrição'],
  testimonials: ['testimonials', 'Testemunhos'],
  users: ['users', 'Gestão de utilizadores'],
  verificacoes: ['verificacoes', 'Verificações'],
};

function getRouteMeta(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const role = segments[1];
  const area = segments[2] || 'overview';

  if (role === 'admin') {
    const [active, title] = ADMIN_ROUTE_META[area] || [
      'overview',
      'Administração',
    ];
    return { role, active, title, subtitle: 'Administração da plataforma' };
  }

  if (role === 'empresa') {
    if (area === 'candidato') {
      return {
        role,
        active: 'candidates',
        title: 'Perfil do candidato',
        subtitle: 'Avaliação e acompanhamento de talento',
      };
    }

    return {
      role,
      active: 'jobs',
      title: 'Minhas vagas',
      subtitle: 'Gestão do processo de recrutamento',
    };
  }

  return {
    role: 'candidato',
    active: area === 'vaga' ? 'saved' : 'candidaturas',
    title: area === 'vaga' ? 'Vagas guardadas' : 'Minhas candidaturas',
    subtitle: 'Acompanhe a sua evolução profissional',
  };
}

export default function DashboardRouteFrame({ Component, pageProps }) {
  const router = useRouter();
  const { user } = useAuth();
  const pathname = router.pathname || '';
  const isDashboardRoute = /^\/dashboard\/(admin|empresa|candidato)(\/|$)/.test(
    pathname,
  );

  if (!isDashboardRoute || SELF_CONTAINED_ROUTES.has(pathname)) {
    return <Component {...pageProps} />;
  }

  const meta = getRouteMeta(pathname);
  const name = user?.displayName || user?.email?.split('@')[0];
  const isCandidateDashboard = meta.role === 'candidato';
  const isCompanyDashboard = meta.role === 'empresa';

  return (
    <DashboardShell
      role={meta.role}
      active={meta.active}
      title={meta.title}
      subtitle={meta.subtitle}
      profileInTopbar={isCandidateDashboard || isCompanyDashboard}
      onProfileClick={
        isCandidateDashboard
          ? () => router.push('/dashboard/candidato?tab=profile')
          : isCompanyDashboard
            ? () => router.push('/dashboard/empresa/profile')
            : undefined
      }
      profile={{
        name:
          name ||
          (meta.role === 'admin'
            ? 'Administrador'
            : meta.role === 'empresa'
              ? 'Empresa'
              : 'Candidato'),
        role:
          meta.role === 'admin'
            ? 'Administrador'
            : meta.role === 'empresa'
              ? 'Empresa'
              : 'Candidato',
        avatarUrl: user?.photoURL || undefined,
      }}
    >
      <div className="dash-legacy-page">
        <Component {...pageProps} />
      </div>
    </DashboardShell>
  );
}
