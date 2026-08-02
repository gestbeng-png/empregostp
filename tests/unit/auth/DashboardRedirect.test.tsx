import { render, screen, waitFor } from '@testing-library/react';

import Dashboard from '../../../pages/dashboard';

const replace = jest.fn();
const useAuth = jest.fn();
const getDoc = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'user-reference'),
  getDoc: (...args: unknown[]) => getDoc(...args),
}));

jest.mock('../../../lib/firebase', () => ({
  db: {},
}));

describe('encaminhamento do dashboard', () => {
  beforeEach(() => {
    replace.mockReset();
    useAuth.mockReset();
    getDoc.mockReset();
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
    useAuth.mockReturnValue({ loading: false, user: { uid: 'user-id' } });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ userType }),
    });

    render(<Dashboard />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
  });

  test('encaminha um perfil sem tipo reconhecido para a página inicial', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    useAuth.mockReturnValue({ loading: false, user: { uid: 'user-id' } });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ userType: 'desconhecido' }),
    });

    render(<Dashboard />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });
});
