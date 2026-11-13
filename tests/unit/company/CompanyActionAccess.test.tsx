import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import EmpresasPage from '../../../pages/empresas';

const mockAuth: {
  user: null | { uid: string; getIdToken: () => Promise<string> };
  loading: boolean;
} = { user: null, loading: false };
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('../../../lib/firebaseAdmin', () => ({ admin: {} }));

const originalFetch = global.fetch;
const destination = '/dashboard/empresa/vaga/criar-vaga';
beforeEach(() => {
  mockAuth.user = null;
  mockAuth.loading = false;
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { data: { userType: 'empresa' } } }),
    });
});
afterEach(() => {
  global.fetch = originalFetch;
});

test.each(['admin', 'candidato'])(
  '%s não tem botões empresariais clicáveis, URLs ou modais',
  async (role) => {
    mockAuth.user = {
      uid: 'synthetic-account',
      getIdToken: async () => 'synthetic-token',
    };
    jest
      .mocked(global.fetch)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ profile: { data: { userType: role } } }),
      } as Response);
    const user = userEvent.setup();
    render(<EmpresasPage />);
    const button = screen.getByRole('button', { name: 'Publicar uma vaga' });
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
    for (const label of [
      'Publicar uma vaga',
      'Pedir um serviço',
      'Patrocinar uma vaga',
      'Criar conta de empresa',
    ]) {
      const action = screen.getByRole('button', { name: label });
      expect(action).toBeDisabled();
      expect(action).not.toHaveAttribute('href');
      expect(
        screen.queryByRole('link', { name: label }),
      ).not.toBeInTheDocument();
    }
    await user.click(button);
    await user.keyboard('{Enter} ');
    expect(button).not.toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  },
);

test('empresa continua a publicar e a gerir o próprio perfil', async () => {
  mockAuth.user = {
    uid: 'synthetic-company',
    getIdToken: async () => 'synthetic-token',
  };
  render(<EmpresasPage />);
  expect(
    await screen.findByRole('link', { name: 'Publicar uma vaga' }),
  ).toHaveAttribute('href', destination);
  expect(
    screen.getByRole('link', { name: 'Criar conta de empresa' }),
  ).toHaveAttribute('href', '/dashboard/empresa/profile');
  expect(
    screen.getByRole('link', { name: 'Pedir um serviço' }),
  ).toHaveAttribute('href', '/dashboard/empresa?tab=hr-services');
});

test('visitante conserva login e registo, e pode consultar os perfis públicos', () => {
  render(<EmpresasPage />);
  expect(
    screen.getByRole('link', { name: 'Publicar uma vaga' }),
  ).toHaveAttribute(
    'href',
    '/login?redirect=' + encodeURIComponent(destination),
  );
  expect(
    screen.getByRole('link', { name: 'Procurar candidatos' }),
  ).toHaveAttribute('href', '/verificados');
  expect(
    screen.getByRole('link', { name: 'Criar conta de empresa' }),
  ).toHaveAttribute('href', '/register?type=empresa');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('se a consulta do perfil falha, publicar permanece desativado', async () => {
  mockAuth.user = {
    uid: 'synthetic-account',
    getIdToken: async () => 'synthetic-token',
  };
  jest.mocked(global.fetch).mockRejectedValue(new Error('offline'));
  render(<EmpresasPage />);
  const button = screen.getByRole('button', { name: 'Publicar uma vaga' });
  await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
  expect(button).toBeDisabled();
  expect(button).not.toHaveAttribute('href');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
