import { render, screen, waitFor } from '@testing-library/react';

import PremiumRedirect from '../../../pages/premium';

const replace = jest.fn();
const useAuth = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

jest.mock('../../../lib/serverSession', () => ({
  requireSessionAccount: jest.fn(),
}));

describe('encaminhamento premium', () => {
  beforeEach(() => {
    replace.mockReset();
    useAuth.mockReset();
  });

  test('apresenta um estado de encaminhamento enquanto valida a conta', () => {
    useAuth.mockReturnValue({ loading: true, user: null });

    render(<PremiumRedirect />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A abrir os seus planos',
      }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(replace).not.toHaveBeenCalled();
  });

  test('encaminha uma sessão anónima para o início de sessão', async () => {
    useAuth.mockReturnValue({ loading: false, user: null });

    render(<PremiumRedirect />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  test('encaminha o candidato autenticado para os seus planos', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token');
    useAuth.mockReturnValue({
      loading: false,
      user: { getIdToken, uid: 'candidate-id' },
    });
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        profile: { data: { userType: 'candidato' } },
      }),
      ok: true,
    });

    render(<PremiumRedirect />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/premium/candidatos'),
    );
  });

  test.each([
    ['empresa', '/premium/empresa'],
    ['admin', '/dashboard/admin'],
  ])(
    '%s não é encaminhado para planos de candidato nem para o login',
    async (userType, destination) => {
      useAuth.mockReturnValue({
        loading: false,
        user: {
          getIdToken: async () => 'synthetic-token',
          uid: 'synthetic-account',
        },
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profile: { data: { userType } } }),
      });
      render(<PremiumRedirect />);
      await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
      expect(replace).not.toHaveBeenCalledWith('/premium/candidatos');
      expect(replace).not.toHaveBeenCalledWith('/login');
    },
  );

  // O encaminhamento de /premium/candidatos e /premium/empresa deixou de ser
  // incondicional e passou a depender da sessão; vive agora, com os dois
  // casos, em tests/unit/pages/PremiumPlansRouting.test.ts.
});
