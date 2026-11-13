import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LandingHeader from '../../../components/LandingHeader';
import { DashboardShellProvider } from '../../../context/DashboardShellContext';

const mockRouter = { pathname: '/', asPath: '/', push: jest.fn() };
const mockAuth: {
  user: null | { email: string; getIdToken: () => Promise<string> };
  loading: boolean;
  logout: jest.Mock;
} = { user: null, loading: false, logout: jest.fn() };

jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = null;
  mockAuth.loading = false;
  mockAuth.logout.mockResolvedValue({ success: true });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ profile: { data: { fullName: 'Maria Teste' } } }),
  })) as jest.Mock;
});

afterEach(() => {
  global.fetch = originalFetch;
});

test.each(['light', 'default', 'dashboard'])(
  'o cabeçalho %s mantém o destino de login com o novo texto e a seta decorativa',
  (variant) => {
    render(<LandingHeader variant={variant} />);
    const login = screen.getByRole('link', { name: 'Iniciar sessão' });
    expect(login).toHaveAttribute('href', '/login');
    expect(login).toHaveClass('lightLoginButton');
    expect(login.querySelector('.loginButtonIcon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(login.querySelector('.loginButtonIcon svg')).toBeInTheDocument();
    if (variant !== 'light')
      expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
        'href',
        '/register',
      );
  },
);

test('o menu móvel reutiliza o mesmo botão e mantém o registo disponível', async () => {
  const user = userEvent.setup();
  render(<LandingHeader />);
  await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
  const menu = screen.getByRole('navigation', { name: 'Navegação móvel' })
    .parentElement as HTMLElement;
  const login = within(menu).getByRole('link', {
    name: 'Iniciar sessão',
  });
  expect(login).toHaveAttribute('href', '/login');
  expect(login).toHaveClass('lightLoginButton');
  expect(
    within(menu).getByRole('link', { name: 'Criar conta' }),
  ).toHaveAttribute('href', '/register');
  await user.keyboard('{Escape}');
  expect(
    screen.queryByRole('navigation', { name: 'Navegação móvel' }),
  ).not.toBeInTheDocument();
});

test('não mostra o login enquanto a sessão está a ser resolvida', () => {
  mockAuth.loading = true;
  const { container, rerender } = render(<LandingHeader />);
  expect(
    screen.queryByRole('link', { name: 'Iniciar sessão' }),
  ).not.toBeInTheDocument();
  expect(container.querySelector('.authActions')).toHaveClass('authPending');
  mockAuth.loading = false;
  rerender(<LandingHeader />);
  expect(screen.getByRole('link', { name: 'Iniciar sessão' })).toBeVisible();
});

test('uma sessão ativa mantém o menu da conta e o logout, sem mostrar o login', async () => {
  const user = userEvent.setup();
  mockAuth.user = {
    email: 'maria@example.com',
    getIdToken: async () => 'test-token',
  };
  render(<LandingHeader />);
  const account = await screen.findByRole('button', {
    name: 'Abrir menu da conta de Maria Teste',
  });
  expect(
    screen.queryByRole('link', { name: 'Iniciar sessão' }),
  ).not.toBeInTheDocument();
  await user.click(account);
  expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute(
    'href',
    '/dashboard',
  );
  await user.click(screen.getByRole('menuitem', { name: 'Sair' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/'));
  expect(mockAuth.logout).toHaveBeenCalledTimes(1);
});

test('não duplica o cabeçalho dentro de um dashboard', () => {
  const { container } = render(
    <DashboardShellProvider value={true}>
      <LandingHeader />
    </DashboardShellProvider>,
  );
  expect(container).toBeEmptyDOMElement();
});
