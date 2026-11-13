import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ActionLink, {
  AccountActionProvider,
} from '../../../components/auth/AccountActionLink';
import { getActionAccountType } from '../../../lib/accountActionAccess';
import HomePage from '../../../pages/index';

const mockAuth: {
  user: null | { uid: string; getIdToken: () => Promise<string> };
  loading: boolean;
} = { user: null, loading: false };
const mockRouter = { query: {}, asPath: '/', pathname: '/', push: jest.fn() };
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('../../../lib/firebaseAdmin', () => ({ admin: {} }));
jest.mock('../../../components/LandingHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../components/AnnouncementBar', () => ({
  __esModule: true,
  default: () => null,
}));

const originalFetch = global.fetch;
function account(role: string) {
  mockAuth.user = {
    uid: 'synthetic-' + role,
    getIdToken: async () => 'synthetic-token',
  };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ profile: { data: { userType: role } } }),
  });
}
beforeEach(() => {
  mockAuth.user = null;
  mockAuth.loading = false;
  global.fetch = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
});

const roles = ['candidato', 'empresa', 'admin'] as const;
test.each(roles.flatMap((actor) => roles.map((target) => ({ actor, target }))))(
  '$actor só pode clicar na funcionalidade de $target se for o seu próprio perfil',
  async ({ actor, target }) => {
    account(actor);
    const onClick = jest.fn();
    const onKeyDown = jest.fn();
    const onAuxClick = jest.fn();
    render(
      <AccountActionProvider>
        <ActionLink
          href={'/dashboard/' + target}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onAuxClick={onAuxClick}
        >
          Executar ação
        </ActionLink>
      </AccountActionProvider>,
    );
    if (actor === target) {
      expect(
        await screen.findByRole('link', { name: 'Executar ação' }),
      ).toHaveAttribute('href', '/dashboard/' + target);
    } else {
      const button = screen.getByRole('button', { name: 'Executar ação' });
      await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('href');
      fireEvent.click(button);
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyDown(button, { key: ' ' });
      fireEvent(
        button,
        new MouseEvent('auxclick', { button: 1, bubbles: true }),
      );
      expect(onClick).not.toHaveBeenCalled();
      expect(onKeyDown).not.toHaveBeenCalled();
      expect(onAuxClick).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('link', { name: 'Executar ação' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  },
);

test.each(roles)(
  'home e rodapé respeitam a sessão %s, com uma única consulta de perfil',
  async (role) => {
    account(role);
    render(<HomePage />);
    await waitFor(() =>
      expect(
        screen.getByRole(role === 'candidato' ? 'link' : 'button', {
          name: 'Criar conta como candidato',
        }),
      ).not.toHaveAttribute('aria-busy'),
    );
    const candidateCta = screen.getByRole(
      role === 'candidato' ? 'link' : 'button',
      { name: 'Criar conta como candidato' },
    );
    const employerCta = screen.getByRole(
      role === 'empresa' ? 'link' : 'button',
      { name: 'Criar conta como empregador' },
    );
    if (role !== 'candidato') expect(candidateCta).toBeDisabled();
    if (role !== 'empresa') expect(employerCta).toBeDisabled();
    const footer = screen.getByRole('contentinfo');
    const cv = footer.querySelector('[data-required-account="candidato"]');
    const publish = footer.querySelector('[data-required-account="empresa"]');
    if (role !== 'candidato') expect(cv).toBeDisabled();
    if (role !== 'empresa') expect(publish).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('link', { name: 'Encontrar vagas' }),
    ).toHaveAttribute('href', '/vagas');
  },
);

test('sessão ativa não pode acionar um registo genérico para criar outro perfil', async () => {
  account('admin');
  render(
    <AccountActionProvider>
      <ActionLink href="/register">Criar outra conta</ActionLink>
    </AccountActionProvider>,
  );
  const button = screen.getByRole('button', { name: 'Criar outra conta' });
  await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
  expect(button).toBeDisabled();
  expect(button).not.toHaveAttribute('href');
});

test.each([
  ['/dashboard/candidato?tab=verification', 'candidato'],
  ['/dashboard/empresa/vaga/criar-vaga', 'empresa'],
  ['/dashboard/admin/jobs/create', 'admin'],
  ['/premium/candidatos', 'candidato'],
  ['/premium/empresa', 'empresa'],
  ['/recursos/gerador-cv', 'candidato'],
  ['/register?type=candidate', 'candidato'],
  ['/register?type=empresa', 'empresa'],
  ['/login?type=empresa', 'empresa'],
  ['/login?redirect=%2Fdashboard%2Fcandidato', 'candidato'],
  ['/vagas', null],
  ['/verificados', null],
  ['/candidatos', null],
  ['/empresas', null],
  ['/recursos', null],
  ['/dashboard', null],
  ['/premium', null],
  ['/candidatos/public-id', null],
  ['https://example.com/dashboard/admin', null],
  ['/dashboard/empresas', null],
])('classifica %s sem bloquear páginas públicas', (path, expected) => {
  expect(getActionAccountType(path)).toBe(expected);
});

test('reconhece destinos Next com query em objeto', () => {
  expect(
    getActionAccountType({ pathname: '/register', query: { type: 'company' } }),
  ).toBe('empresa');
});

test('uma URL de registo admin nunca encaminha o administrador para o candidato', async () => {
  account('admin');
  render(
    <AccountActionProvider>
      <ActionLink href="/register?type=admin">Meu perfil</ActionLink>
    </AccountActionProvider>,
  );
  expect(
    await screen.findByRole('link', { name: 'Meu perfil' }),
  ).toHaveAttribute('href', '/dashboard/admin');
});

test('URL de ação em objeto mantém o destino no login do visitante', () => {
  render(
    <AccountActionProvider>
      <ActionLink
        href={{ pathname: '/dashboard/empresa', query: { tab: 'jobs' } }}
      >
        Publicar
      </ActionLink>
    </AccountActionProvider>,
  );
  expect(screen.getByRole('link', { name: 'Publicar' })).toHaveAttribute(
    'href',
    '/login?redirect=%2Fdashboard%2Fempresa%3Ftab%3Djobs',
  );
});
