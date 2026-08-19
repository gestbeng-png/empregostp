import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithPopup } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';

import Register from '../../../pages/register';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { google: 'true' } }),
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('../../../lib/firebaseAuth', () => ({
  __esModule: true,
  default: {
    currentUser: {
      displayName: 'Maria Graça',
      photoURL: 'https://example.test/maria.jpg',
      providerData: [{ providerId: 'google.com' }],
      getIdToken: jest.fn().mockResolvedValue('google-id-token'),
    },
    signOut: jest.fn(),
  },
}));

jest.mock('../../../lib/firestore', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('nookies', () => ({
  set: jest.fn(),
}));

const mockedGetDoc = jest.mocked(getDoc);
const mockedSignInWithPopup = jest.mocked(signInWithPopup);

describe('continuação do registo Google', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ needsTypeSelection: true }),
    } as never);
    global.fetch = jest.fn(
      () => new Promise<Response>(() => undefined),
    ) as typeof fetch;
  });

  test('reutiliza a sessão Google e conclui a escolha em /register', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await user.click(screen.getByLabelText(/Sou um candidato/i));
    await user.click(
      screen.getByRole('button', {
        name: /Continuar como candidato com Google/i,
      }),
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(mockedSignInWithPopup).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/setup-user',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer google-id-token',
        }),
      }),
    );

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      userType: 'candidato',
      fullName: 'Maria Graça',
      provider: 'google',
    });
  });
});
