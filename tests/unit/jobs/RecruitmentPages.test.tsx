import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { requireAdminPageAuth } from '@/lib/adminPageGuard';
import { apiRequest } from '@/lib/apiClient';
import { requireSession } from '@/lib/serverSession';
import OperationsPage, {
  getServerSideProps as operationsGuard,
} from '@/pages/dashboard/admin/operations';
import InvitationPage, {
  getServerSideProps as invitationGuard,
} from '@/pages/equipa/convite';
const mockRouter = {
  query: { i: 'inv', t: 'synthetic-invitation-token' },
  isReady: true,
  replace: jest.fn(),
};
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/components/dashboard/DashboardShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
jest.mock('@/lib/serverSession', () => ({ requireSession: jest.fn() }));
jest.mock('@/lib/adminPageGuard', () => ({ requireAdminPageAuth: jest.fn() }));
jest.mock('@/lib/apiClient', () => ({ apiRequest: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(apiRequest)
    .mockResolvedValue({
      status: 'PENDING',
      organizationId: 'org',
      organizationName: 'Empresa de teste',
      role: 'RECRUITER',
      emailMatches: true,
      emailVerified: true,
      expiresAt: '2026-10-30T10:00:00Z',
    });
});
test('invite acceptance is explicit, uses the URL token, and removes it after acceptance', async () => {
  render(<InvitationPage />);
  const form = await screen.findByRole('form', {
    name: 'Aceitação do convite',
  });
  expect(
    jest
      .mocked(apiRequest)
      .mock.calls.some(([path]) => path.endsWith('/accept')),
  ).toBe(false);
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);
  await screen.findByRole('link', {
    name: 'Abrir recrutamento da organização',
  });
  expect(apiRequest).toHaveBeenCalledWith(
    '/api/invitations/inv/accept',
    expect.objectContaining({ body: { token: 'synthetic-invitation-token' } }),
  );
  expect(mockRouter.replace).toHaveBeenCalledWith(
    '/equipa/convite',
    undefined,
    { shallow: true },
  );
});
test('invitation SSR accepts any active account guard, marks page private and suppresses referrer', async () => {
  jest.mocked(requireSession).mockResolvedValue(null);
  const context = { res: { setHeader: jest.fn() } };
  expect(await invitationGuard(context)).toEqual({ props: {} });
  expect(context.res.setHeader).toHaveBeenCalledWith(
    'Referrer-Policy',
    'no-referrer',
  );
  expect(context.res.setHeader).toHaveBeenCalledWith(
    'Cache-Control',
    'private, no-store',
  );
});

test.each([
  ['EXPIRED', /Este convite expirou/],
  ['REVOKED', /Este convite foi revogado/],
  ['ACCEPTED', /Este convite já foi aceite/],
])(
  'invitation status %s offers guidance without accepting',
  async (status, label) => {
    jest.mocked(apiRequest).mockResolvedValue({ status });
    render(<InvitationPage />);
    await screen.findByText(label);
    expect(
      screen.queryByRole('form', { name: 'Aceitação do convite' }),
    ).toBeNull();
    expect(
      jest
        .mocked(apiRequest)
        .mock.calls.some(([path]) => path.endsWith('/accept')),
    ).toBe(false);
  },
);
test('wrong account shows the account-switch action, not an acceptance form', async () => {
  jest
    .mocked(apiRequest)
    .mockResolvedValue({
      status: 'PENDING',
      organizationName: 'Empresa Alfa',
      emailMatches: false,
      emailVerified: true,
    });
  render(<InvitationPage />);
  await screen.findByRole('button', { name: 'Entrar com outra conta' });
  expect(
    screen.queryByRole('form', { name: 'Aceitação do convite' }),
  ).toBeNull();
});
test('unverified email cannot accept and has a refresh-session action', async () => {
  jest
    .mocked(apiRequest)
    .mockResolvedValue({
      status: 'PENDING',
      emailMatches: true,
      emailVerified: false,
    });
  render(<InvitationPage />);
  await screen.findByRole('button', { name: 'Já confirmei o meu email' });
  expect(
    screen.queryByRole('form', { name: 'Aceitação do convite' }),
  ).toBeNull();
});
test('admin operations requires the server admin page guard', async () => {
  const redirect = { destination: '/login', permanent: false };
  jest
    .mocked(requireAdminPageAuth)
    .mockResolvedValue({ ok: false, redirect } as never);
  expect(await operationsGuard({ res: { setHeader: jest.fn() } })).toEqual({
    redirect,
  });
});
test('admin can annul a selected hire even if queue health is temporarily unavailable', async () => {
  jest.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === '/api/admin/operations')
      throw new Error('Saúde indisponível.');
    if (path === '/api/admin/recruitment')
      return {
        hires: [{ id: 'h', jobId: 'j', candidateConfirmation: 'PENDING' }],
      };
    return {};
  });
  render(<OperationsPage />);
  await screen.findByText('Saúde indisponível.');
  const form = await screen.findByRole('form', { name: 'Anular contratação' });
  fireEvent.change(within(form).getByRole('textbox'), {
    target: { value: 'Registo incorreto validado pela equipa' },
  });
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/hires/h/annul',
      expect.objectContaining({
        body: { reason: 'Registo incorreto validado pela equipa' },
      }),
    ),
  );
});
