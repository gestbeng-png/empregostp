import { getDashboardNav } from '../../../components/dashboard/dashboardNav';
import { resolveDashboardTab } from '../../../lib/dashboardNavigation';

type DashboardNavItem = {
  key: string;
  label: string;
  href?: string;
  icon: string;
};

describe('navegação dos dashboards', () => {
  const validTabs = new Set(['dashboard', 'notifications', 'candidates']);

  it('mantém um separador válido e normaliza o valor da URL', () => {
    expect(resolveDashboardTab(' Notifications ', validTabs)).toBe(
      'notifications',
    );
  });

  it.each([undefined, '', 'unknown', ['unknown']])(
    'volta à visão geral quando o parâmetro é removido ou inválido: %p',
    (queryTab) => {
      expect(resolveDashboardTab(queryTab, validTabs)).toBe('dashboard');
    },
  );

  it('aceita o primeiro valor quando o router fornece um parâmetro repetido', () => {
    expect(
      resolveDashboardTab(['candidates', 'notifications'], validTabs),
    ).toBe('candidates');
  });

  it('expõe as notificações completas na navegação do candidato', () => {
    const candidateNav = getDashboardNav('candidato') as Array<{
      items: DashboardNavItem[];
    }>;
    const notificationItem = candidateNav
      .flatMap((section) => section.items)
      .find((item) => item.key === 'notifications');

    expect(notificationItem).toMatchObject({
      label: 'Notificações',
      href: '/dashboard/candidato?tab=notifications',
      icon: 'bell',
    });
  });

  it('mantém o perfil do candidato fora da navegação lateral', () => {
    const candidateNav = getDashboardNav('candidato') as Array<{
      items: DashboardNavItem[];
    }>;
    const candidateItems = candidateNav.flatMap((section) => section.items);

    expect(candidateItems.some((item) => item.key === 'profile')).toBe(false);
  });

  it('mantém o perfil da empresa fora da navegação lateral', () => {
    const companyNav = getDashboardNav('empresa') as Array<{
      items: DashboardNavItem[];
    }>;
    const companyItems = companyNav.flatMap((section) => section.items);

    expect(companyItems.some((item) => item.key === 'company-profile')).toBe(
      false,
    );
  });

  it('expõe uma única navegação Admin completa e sem destinos duplicados', () => {
    const adminNav = getDashboardNav('admin') as Array<{
      items: DashboardNavItem[];
    }>;
    const adminItems = adminNav.flatMap((section) => section.items);
    const hrefs = adminItems.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(adminItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'jobs', href: '/dashboard/admin/jobs' }),
        expect.objectContaining({ key: 'news', href: '/dashboard/admin/news' }),
        expect.objectContaining({
          key: 'resources',
          href: '/dashboard/admin/resources',
        }),
        expect.objectContaining({
          key: 'subscriptions',
          href: '/dashboard/admin/subscription-requests',
        }),
        expect.objectContaining({
          key: 'audit',
          href: '/dashboard/admin/auditoria',
        }),
      ]),
    );
  });
});
