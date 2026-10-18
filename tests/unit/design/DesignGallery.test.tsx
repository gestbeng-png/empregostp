import { fireEvent, render, screen } from '@testing-library/react';

import DesignGallery from '@/components/design/DesignGallery';
import { requireAdminPageAuth } from '@/lib/adminPageGuard';
import { getServerSideProps } from '@/pages/_design';

jest.mock('@/lib/adminPageGuard', () => ({ requireAdminPageAuth: jest.fn() }));
jest.mock('@/components/dashboard/DashboardShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/_design',
    events: { on: jest.fn(), off: jest.fn() },
    push: jest.fn(),
  }),
}));

describe('Galeria interna: acesso e demonstrações sem escrita', () => {
  const guard = jest.mocked(requireAdminPageAuth);
  test('sem sessão ou papel ADMIN, redireciona sem serializar a conta', async () => {
    const res = { setHeader: jest.fn() };
    guard.mockResolvedValue({
      ok: false,
      redirect: { destination: '/login', permanent: false },
    });
    expect(await getServerSideProps({ res })).toEqual({
      redirect: { destination: '/login', permanent: false },
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Robots-Tag',
      'noindex, nofollow',
    );
    guard.mockResolvedValue({
      ok: true,
      uid: 'synthetic-admin',
      userData: { userType: 'admin', email: 'private@example.test' },
    });
    expect(await getServerSideProps({ res })).toEqual({ props: {} });
  });
  test('estados de formulário e exemplos sem submits reais', () => {
    const { container } = render(<DesignGallery />);
    expect(screen.getByLabelText('Campo desativado')).toBeDisabled();
    expect(screen.getByLabelText(/Email com erro/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText(/Ficheiro de demonstração/)).toHaveAttribute(
      'type',
      'file',
    );
    expect(container.querySelectorAll('form')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar exemplo' }));
    expect(
      screen.getByText('Ação de demonstração concluída.'),
    ).toBeInTheDocument();
  });
  test('separadores por teclado e paginação são locais', () => {
    render(<DesignGallery />);
    const overview = screen.getByRole('tab', { name: 'Visão geral' });
    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Detalhes' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Detalhes: conteúdo fictício.',
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Detalhes' }), {
      key: 'Home',
    });
    expect(overview).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguinte' })).toBeDisabled();
  });
});
