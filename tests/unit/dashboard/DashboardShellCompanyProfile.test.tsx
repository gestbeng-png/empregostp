import { fireEvent, render, screen, within } from '@testing-library/react';

import DashboardShell from '../../../components/dashboard/DashboardShell';

const mockPush = jest.fn();
const mockUseAuth = jest.fn();

type CompanyProfile = {
  name: string;
  role: string;
  plan?: string;
};

jest.mock('next/router', () => ({
  useRouter: () => ({
    events: { on: jest.fn(), off: jest.fn() },
    push: mockPush,
  }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function CompanyShell({ profile }: { profile: CompanyProfile }) {
  return (
    <DashboardShell
      role="empresa"
      active="dashboard"
      title="Visão geral"
      subtitle={undefined}
      profile={profile}
      nav={undefined}
      sidebarTop={undefined}
      sidebarFooter={undefined}
      themeMode={undefined}
      searchPlaceholder={undefined}
      searchValue={undefined}
      onSearchChange={undefined}
      topbarActions={undefined}
      onLogout={undefined}
      profileInTopbar={undefined}
      onProfileClick={undefined}
    >
      <p>Conteúdo do painel</p>
    </DashboardShell>
  );
}

describe('perfil da empresa no dashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.dashboardTheme;
    mockPush.mockReset();
    mockUseAuth.mockReturnValue({
      logout: jest.fn(),
      user: {
        displayName: 'Edmir Santos',
        email: 'edmir@example.com',
      },
    });
  });

  test('move a identidade para o topbar e abre o perfil empresarial', () => {
    render(
      <CompanyShell
        profile={{ name: 'Edmir Santos', role: 'Empresa', plan: 'Básico' }}
      />,
    );

    const sidebar = screen.getByRole('complementary', {
      name: 'Navegação do painel de Empresa',
    });
    const themeButton = screen.getByRole('button', {
      name: 'Usar tema escuro',
    });
    const profileButton = screen.getByRole('button', {
      name: 'Abrir perfil da empresa',
    });

    expect(within(sidebar).queryByText('Edmir Santos')).not.toBeInTheDocument();
    expect(
      within(sidebar).queryByRole('link', { name: 'Perfil empresa' }),
    ).not.toBeInTheDocument();
    expect(within(profileButton).getByText('Edmir Santos')).toBeVisible();
    expect(within(profileButton).getByText('Empresa')).toBeVisible();
    expect(within(profileButton).getByText('Básico')).toBeVisible();
    expect(themeButton.nextElementSibling?.nextElementSibling).toBe(
      profileButton,
    );

    fireEvent.click(themeButton);
    expect(
      screen.getByRole('button', { name: 'Usar tema claro' }),
    ).toBeVisible();
    expect(window.localStorage.getItem('estp-theme')).toBe('dark');
    expect(document.documentElement).toHaveAttribute(
      'data-dashboard-theme',
      'dark',
    );

    fireEvent.click(profileButton);
    expect(mockPush).toHaveBeenCalledWith('/dashboard/empresa/profile');
  });

  test('usa o nome autenticado nas páginas empresariais com perfil genérico', () => {
    render(<CompanyShell profile={{ name: 'Empresa', role: 'Empresa' }} />);

    const profileButton = screen.getByRole('button', {
      name: 'Abrir perfil da empresa',
    });
    expect(within(profileButton).getByText('Edmir Santos')).toBeVisible();
  });
});
