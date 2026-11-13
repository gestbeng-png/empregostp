import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';

import VagaDetalhe from '../../../pages/vaga/[id]';

const mockUser = {
  uid: 'synthetic-account',
  getIdToken: async () => 'synthetic-token',
};
const mockAuth: { user: typeof mockUser | null; loading: boolean } = {
  user: mockUser,
  loading: false,
};
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../lib/firebaseAuth', () => ({
  auth: { currentUser: mockUser },
}));
jest.mock('../../../lib/firebaseAdmin', () => ({ admin: {} }));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('../../../components/UpgradeModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../components/forms/AutoSaveStatus', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../hooks/useAutoDraft', () => ({
  __esModule: true,
  default: () => ({
    clearDraft: jest.fn(),
    hasDraft: false,
    isOnline: true,
    lastSavedAt: '',
    status: 'idle',
  }),
}));

const vaga = {
  id: 'synthetic-job',
  titulo: 'Contabilista',
  descricao: 'Vaga sintética',
  companyName: 'Empresa de teste',
  status: 'active',
};
const originalFetch = global.fetch;
function response(userType: string) {
  return {
    ok: true,
    json: async () => ({
      profile: { data: { userType } },
      applications: [],
      savedJobs: [],
    }),
  } as Response;
}
beforeEach(() => {
  mockAuth.user = mockUser;
  mockAuth.loading = false;
  global.fetch = jest.fn().mockResolvedValue(response('candidato'));
});
afterEach(() => {
  global.fetch = originalFetch;
});

test.each(['empresa', 'admin'])(
  '%s pode consultar a vaga, mas não candidatar-se nem guardar',
  async (userType) => {
    jest.mocked(global.fetch).mockResolvedValue(response(userType));
    render(<VagaDetalhe vaga={vaga} />);
    const buttons = await screen.findAllByRole('button', {
      name: 'Conta de candidato necessária',
    });
    for (const button of buttons) expect(button).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Guardar vaga' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir para o meu painel' }),
    ).toHaveAttribute('href', '/dashboard');
    expect(
      jest
        .mocked(global.fetch)
        .mock.calls.some(
          ([url]) =>
            String(url).startsWith('/api/applications') ||
            url === '/api/saved-jobs',
        ),
    ).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

test('erro na consulta do perfil não abre o formulário de candidatura', async () => {
  jest
    .mocked(global.fetch)
    .mockImplementation(async (url) =>
      url === '/api/profile'
        ? ({ ok: false } as Response)
        : response('candidato'),
    );
  render(<VagaDetalhe vaga={vaga} />);
  const buttons = await screen.findAllByRole('button', {
    name: 'Conta de candidato necessária',
  });
  for (const button of buttons) {
    expect(button).toBeDisabled();
    fireEvent.click(button);
  }
  expect(
    screen.getByText(/Não foi possível validar o seu perfil/),
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Guardar vaga' }),
  ).not.toBeInTheDocument();
});

test('enquanto o perfil carrega, as ações não abrem e depois continuam a funcionar para candidato', async () => {
  let resolveProfile: (value: Response) => void = () => {};
  jest.mocked(global.fetch).mockImplementation(async (url) =>
    url === '/api/profile'
      ? new Promise<Response>((resolve) => {
          resolveProfile = resolve;
        })
      : response('candidato'),
  );
  render(<VagaDetalhe vaga={vaga} />);
  for (const button of screen.getAllByRole('button', {
    name: 'A validar perfil…',
  }))
    expect(button).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Guardar vaga' }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profile',
      expect.anything(),
    ),
  );
  await act(async () => {
    resolveProfile(response('candidato'));
  });
  const apply = (
    await screen.findAllByRole('button', { name: 'Candidatar agora' })
  )[0];
  if (!apply) throw new Error('Botão de candidatura não encontrado');
  await waitFor(() => expect(apply).toBeEnabled());
  expect(
    screen.getAllByRole('button', { name: 'Guardar vaga' }).length,
  ).toBeGreaterThan(0);
  fireEvent.click(apply);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

test('visitantes continuam a consultar a vaga e a ter o convite de candidatura', async () => {
  mockAuth.user = null;
  render(<VagaDetalhe vaga={vaga} />);
  const buttons = await screen.findAllByRole('button', {
    name: 'Candidatar agora',
  });
  for (const button of buttons) expect(button).toBeEnabled();
  expect(
    screen.queryByText(/exclusiva de contas de candidato/),
  ).not.toBeInTheDocument();
});
