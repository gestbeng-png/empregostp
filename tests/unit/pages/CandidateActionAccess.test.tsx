import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import CandidateMarketPage from '../../../components/candidates/CandidateMarketPage';

const mockAuth: {
  user: null | { uid: string; getIdToken: () => Promise<string> };
  loading: boolean;
} = { user: null, loading: false };
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('../../../components/home/VerifiedCandidatesCarousel', () => ({
  __esModule: true,
  default: () => null,
}));

const originalFetch = global.fetch;
const destination = '/dashboard/candidato?tab=verification';
function profile(userType: string) {
  return {
    ok: true,
    json: async () => ({ profile: { data: { userType } } }),
  } as Response;
}
function signIn(uid = 'synthetic-account') {
  mockAuth.user = { uid, getIdToken: async () => 'synthetic-token' };
}
beforeEach(() => {
  mockAuth.user = null;
  mockAuth.loading = false;
  global.fetch = jest.fn().mockResolvedValue(profile('candidato'));
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('visitante mantém o destino de login, o registo e a navegação pública', () => {
  render(<CandidateMarketPage />);
  expect(
    screen.getByRole('link', { name: 'Verificar perfil' }),
  ).toHaveAttribute(
    'href',
    '/login?redirect=' + encodeURIComponent(destination),
  );
  expect(screen.getByRole('link', { name: 'Criar perfil' })).toHaveAttribute(
    'href',
    '/register?type=candidate',
  );
  for (const link of screen.getAllByRole('link', { name: 'Explorar vagas' }))
    expect(link).toHaveAttribute('href', '/vagas');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('candidato continua a usar as próprias funcionalidades, com uma só leitura de perfil', async () => {
  signIn();
  render(<CandidateMarketPage />);
  expect(
    await screen.findByRole('link', { name: 'Verificar perfil' }),
  ).toHaveAttribute('href', destination);
  expect(screen.getByRole('link', { name: 'Criar perfil' })).toHaveAttribute(
    'href',
    '/dashboard/candidato?tab=profile',
  );
  expect(
    screen.getByRole('link', { name: 'Escolher o plano Premium' }),
  ).toHaveAttribute('href', '/premium/candidatos');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/profile',
    expect.objectContaining({
      cache: 'no-store',
      headers: { Authorization: 'Bearer synthetic-token' },
    }),
  );
});

test.each(['empresa', 'admin'])(
  '%s não pode clicar em ações de candidato nem abrir avisos ou links alternativos',
  async (role) => {
    signIn();
    jest.mocked(global.fetch).mockResolvedValue(profile(role));
    const user = userEvent.setup();
    render(<CandidateMarketPage />);
    const verification = screen.getByRole('button', {
      name: 'Verificar perfil',
    });
    await waitFor(() => expect(verification).not.toHaveAttribute('aria-busy'));
    for (const label of [
      'Verificar perfil',
      'Ativar alertas',
      'Criar documentos',
      'Escolher o plano Premium',
    ]) {
      const button = screen.getByRole('button', { name: label });
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('href');
      expect(
        screen.queryByRole('link', { name: label }),
      ).not.toBeInTheDocument();
    }
    await user.click(verification);
    await user.keyboard('{Enter} ');
    expect(verification).not.toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

test('enquanto valida a sessão, os botões já nascem desativados', () => {
  mockAuth.loading = true;
  render(<CandidateMarketPage />);
  const button = screen.getByRole('button', { name: 'Verificar perfil' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button).not.toHaveAttribute('href');
  fireEvent.click(button);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('falha de perfil bloqueia; recuperar a ligação volta a validar sem assumir permissões', async () => {
  signIn();
  jest.mocked(global.fetch).mockRejectedValueOnce(new Error('offline'));
  render(<CandidateMarketPage />);
  const button = screen.getByRole('button', { name: 'Verificar perfil' });
  await waitFor(() =>
    expect(button).toHaveAttribute(
      'title',
      expect.stringContaining('Não foi possível validar o perfil'),
    ),
  );
  expect(button).toBeDisabled();
  fireEvent(window, new Event('online'));
  expect(
    await screen.findByRole('link', { name: 'Verificar perfil' }),
  ).toHaveAttribute('href', destination);
});

test('uma resposta atrasada da conta anterior não autoriza uma nova conta de empresa', async () => {
  signIn();
  let resolveProfile: (value: Response) => void = () => {};
  jest.mocked(global.fetch).mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        resolveProfile = resolve;
      }),
  );
  const { rerender } = render(<CandidateMarketPage />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  signIn('synthetic-company');
  jest.mocked(global.fetch).mockResolvedValue(profile('empresa'));
  rerender(<CandidateMarketPage />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveProfile(profile('candidato'));
  });
  const button = screen.getByRole('button', { name: 'Verificar perfil' });
  await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
  expect(button).toBeDisabled();
  expect(button).not.toHaveAttribute('href');
});
