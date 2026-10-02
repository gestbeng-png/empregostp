import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';

import { createServerSession, destroyServerSession } from '../../../lib/authSessionClient';
import Login from '../../../pages/login';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { redirect: '//atacante.example' } }),
}));

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  // Sem sessão guardada: o observador devolve logo `null`.
  onIdTokenChanged: jest.fn((_auth, callback) => {
    callback(null);
    return () => undefined;
  }),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

const signOutMock = jest.fn();
jest.mock('../../../lib/firebaseAuth', () => ({
  __esModule: true,
  default: { signOut: (...args: unknown[]) => signOutMock(...args) },
}));

jest.mock('../../../lib/firebase', () => ({ db: {} }));

jest.mock('../../../lib/authSessionClient', () => ({
  createServerSession: jest.fn(),
  destroyServerSession: jest.fn(),
}));

const mockedSignIn = jest.mocked(signInWithEmailAndPassword);
const mockedGetDoc = jest.mocked(getDoc);
const mockedCreateSession = jest.mocked(createServerSession);
const mockedDestroySession = jest.mocked(destroyServerSession);

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'candidate@example.test');
  await user.type(screen.getByLabelText('Senha'), 'SenhaForte1!');
  await user.click(screen.getByRole('button', { name: 'Iniciar sessão' }));
}

describe('estado da conta no login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signOutMock.mockResolvedValue(undefined);
    mockedDestroySession.mockResolvedValue(undefined);
    mockedSignIn.mockResolvedValue({
      user: {
        emailVerified: true,
        getIdToken: jest.fn().mockResolvedValue('id-token'),
        uid: 'candidate-1',
      },
    } as never);
  });

  test.each(['inactive', 'suspended', 'disabled'])(
    'nega login e não cria cookie para status %s',
    async (status) => {
      mockedGetDoc.mockResolvedValue({
        data: () => ({ status, userType: 'candidato' }),
        exists: () => true,
      } as never);
      const user = userEvent.setup();
      render(<Login />);

      await submitLogin(user);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /conta está suspensa ou inativa/i,
      );
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(mockedDestroySession).toHaveBeenCalledTimes(1);
      expect(mockedCreateSession).not.toHaveBeenCalled();
    },
  );
});
