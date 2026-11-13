import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';

import DashboardRouteFrame from '../../../components/dashboard/DashboardRouteFrame';

const mockRouter = {
  pathname: '/dashboard/candidato',
  asPath: '/dashboard/candidato',
  replace: jest.fn(),
};
const mockUseAuth = jest.fn();
const mockFetch = jest.fn();
const mockMounted = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock(
  '../../../components/auth/RedirectGate',
  () =>
    function Status() {
      return <p role="status">A validar o acesso</p>;
    },
);
jest.mock(
  'next/dynamic',
  () => () =>
    function Shell({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    },
);

function PrivateForm() {
  useEffect(() => {
    mockMounted();
  }, []);
  return <input aria-label="Perfil privado" />;
}
function account(accountType: string, uid = 'account-1') {
  return { ok: true, json: async () => ({ uid, accountType }) };
}
function browserUser(uid = 'account-1') {
  return { uid, getIdToken: jest.fn().mockResolvedValue(`token-${uid}`) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.pathname = mockRouter.asPath = '/dashboard/candidato';
  mockUseAuth.mockReturnValue({
    user: browserUser(),
    loading: false,
    sessionReady: true,
  });
  global.fetch = mockFetch;
});

test.each(
  ['candidato', 'empresa', 'admin'].flatMap((route) =>
    ['candidato', 'empresa', 'admin'].map((role) => [route, role]),
  ),
)(
  'rota %s só monta para uma conta %s se os papéis coincidirem',
  async (route, role) => {
    mockRouter.pathname = mockRouter.asPath = `/dashboard/${route}`;
    mockFetch.mockResolvedValue(account(role));
    render(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
    expect(mockMounted).not.toHaveBeenCalled();
    if (route === role) {
      expect(await screen.findByLabelText('Perfil privado')).toBeVisible();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    } else {
      await waitFor(() =>
        expect(mockRouter.replace).toHaveBeenCalledWith(`/dashboard/${role}`),
      );
      expect(mockMounted).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Perfil privado')).not.toBeInTheDocument();
    }
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/account',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: 'Bearer token-account-1' },
      }),
    );
  },
);

test('uma página de candidato anteriormente carregada não abre para o admin', async () => {
  mockFetch
    .mockResolvedValueOnce(account('candidato'))
    .mockResolvedValueOnce(account('admin', 'admin-1'));
  const view = render(
    <DashboardRouteFrame Component={PrivateForm} pageProps={{}} />,
  );
  await screen.findByLabelText('Perfil privado');
  mockUseAuth.mockReturnValue({
    user: browserUser('admin-1'),
    loading: false,
    sessionReady: true,
  });
  view.rerender(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
  expect(screen.queryByLabelText('Perfil privado')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard/admin'),
  );
  expect(mockMounted).toHaveBeenCalledTimes(1);
});

test('não reutiliza dados SSR de outra conta, mesmo sendo do mesmo tipo', async () => {
  mockRouter.pathname = mockRouter.asPath = '/dashboard/empresa';
  mockFetch.mockResolvedValue(account('empresa'));
  render(
    <DashboardRouteFrame
      Component={PrivateForm}
      pageProps={{ __sessionUid: 'previous-company' }}
    />,
  );
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'),
  );
  expect(mockMounted).not.toHaveBeenCalled();
});

test('resposta atrasada da conta anterior não autoriza a conta nova', async () => {
  const old = deferred<ReturnType<typeof account>>();
  const latest = deferred<ReturnType<typeof account>>();
  mockFetch
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(latest.promise);
  const view = render(
    <DashboardRouteFrame Component={PrivateForm} pageProps={{}} />,
  );
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  mockUseAuth.mockReturnValue({
    user: browserUser('admin-1'),
    loading: false,
    sessionReady: true,
  });
  view.rerender(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  await act(async () => old.resolve(account('candidato')));
  expect(mockMounted).not.toHaveBeenCalled();
  await act(async () => latest.resolve(account('admin', 'admin-1')));
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard/admin'),
  );
  expect(mockMounted).not.toHaveBeenCalled();
});

test('espera pelo cookie sincronizado; erros não abrem formulários', async () => {
  const user = browserUser();
  mockUseAuth.mockReturnValue({
    user,
    loading: false,
    sessionReady: false,
    sessionError: 'Falhou',
  });
  render(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
  expect(screen.getByRole('alert')).toBeVisible();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockMounted).not.toHaveBeenCalled();
});

test.each([
  { ok: false, json: async () => ({ error: 'Sem permissão' }) },
  account('candidato', 'outro-uid'),
  account('desconhecido'),
])('falha fechada se a conta não for confirmada', async (response) => {
  mockFetch.mockResolvedValue(response);
  render(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(mockMounted).not.toHaveBeenCalled();
});

test('voltar ao separador revalida e fecha um painel cujo papel mudou', async () => {
  mockFetch
    .mockResolvedValueOnce(account('candidato'))
    .mockResolvedValueOnce(account('admin'));
  render(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
  await screen.findByLabelText('Perfil privado');
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard/admin'),
  );
  expect(screen.queryByLabelText('Perfil privado')).not.toBeInTheDocument();
});

test('voltar do seletor de ficheiros ou de outro separador não apaga um formulário autorizado', async () => {
  mockFetch.mockResolvedValue(account('candidato'));
  render(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
  const input = await screen.findByLabelText('Perfil privado');
  fireEvent.change(input, { target: { value: 'Rascunho' } });
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('Perfil privado')).toHaveValue('Rascunho');
  expect(mockMounted).toHaveBeenCalledTimes(1);
});

test('visitante vai para login sem montar o formulário', async () => {
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    sessionReady: true,
  });
  render(<DashboardRouteFrame Component={PrivateForm} pageProps={{}} />);
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith(
      '/login?redirect=%2Fdashboard%2Fcandidato',
    ),
  );
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockMounted).not.toHaveBeenCalled();
});
