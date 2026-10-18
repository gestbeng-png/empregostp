import { render, screen, waitFor } from '@testing-library/react';

import Dashboard from '../../../pages/dashboard';

const replace = jest.fn();
const useAuth = jest.fn();
const fetchMock = jest.fn();
const getIdToken = jest.fn(async () => 'id-token');
const profileResponse = (userType: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ profile: { data: { userType } } }),
});

jest.mock('next/router', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

describe('encaminhamento do dashboard', () => {
  beforeEach(() => {
    replace.mockReset();
    useAuth.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('apresenta um estado acessível enquanto valida a sessão', () => {
    useAuth.mockReturnValue({ loading: true, user: null });

    render(<Dashboard />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A abrir o seu painel',
      }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(replace).not.toHaveBeenCalled();
  });

  test('encaminha uma sessão anónima para o início de sessão', async () => {
    useAuth.mockReturnValue({ loading: false, user: null });

    render(<Dashboard />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  test.each([
    ['empresa', '/dashboard/empresa'],
    ['candidato', '/dashboard/candidato'],
    ['admin', '/dashboard/admin'],
  ])('encaminha uma conta %s para %s', async (userType, destination) => {
    useAuth.mockReturnValue({
      loading: false,
      user: { uid: 'user-id', getIdToken },
    });
    fetchMock.mockResolvedValue(profileResponse(userType));

    render(<Dashboard />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
    // A /api/profile exige o token: sem ele, todas as contas iam para «/».
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profile?uid=user-id',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
      }),
    );
  });

  test('encaminha um perfil sem tipo reconhecido para a página inicial', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    useAuth.mockReturnValue({
      loading: false,
      user: { uid: 'user-id', getIdToken },
    });
    fetchMock.mockResolvedValue(profileResponse('desconhecido'));

    render(<Dashboard />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });
});
