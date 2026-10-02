import { act, render, screen, waitFor } from '@testing-library/react';
import { onIdTokenChanged } from 'firebase/auth';

import { AuthProvider, useAuth } from '../../../context/AuthContext';
import { createServerSession } from '../../../lib/authSessionClient';

jest.mock('firebase/auth', () => ({
  onIdTokenChanged: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../../../lib/firebase', () => ({
  auth: { currentUser: null, name: 'auth' },
}));

jest.mock('../../../lib/authSessionClient', () => ({
  createServerSession: jest.fn(),
  destroyServerSession: jest.fn(),
}));

jest.mock('../../../lib/webPushClient', () => ({
  unregisterCurrentPushToken: jest.fn(),
}));

const mockedTokenChanged = jest.mocked(onIdTokenChanged);
const mockedCreateSession = jest.mocked(createServerSession);

type TokenListener = (user: unknown) => void;

function capturarObservador() {
  let listener: TokenListener = () => undefined;
  mockedTokenChanged.mockImplementation((_auth, callback) => {
    listener = callback as TokenListener;
    return jest.fn();
  });
  return () => listener;
}

function utilizadorCom(token: string) {
  return { uid: 'candidate-1', getIdToken: jest.fn().mockResolvedValue(token) };
}

function EstadoProbe() {
  const { user } = useAuth();
  return <output>{user ? 'com sessão' : 'sem sessão'}</output>;
}

describe('renovação do cookie de sessão', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateSession.mockResolvedValue(undefined);
  });

  test('recria o cookie quando o Firebase restaura a sessão guardada', async () => {
    const obterObservador = capturarObservador();
    render(
      <AuthProvider>
        <EstadoProbe />
      </AuthProvider>,
    );

    await act(async () => {
      obterObservador()(utilizadorCom('token-restaurado'));
    });

    await waitFor(() =>
      expect(mockedCreateSession).toHaveBeenCalledWith('token-restaurado'),
    );
    expect(await screen.findByText('com sessão')).toBeVisible();
  });

  test('renova o cookie a cada token novo, sem repetir o mesmo', async () => {
    const obterObservador = capturarObservador();
    render(
      <AuthProvider>
        <EstadoProbe />
      </AuthProvider>,
    );

    const observador = obterObservador();
    await act(async () => observador(utilizadorCom('token-1')));
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledTimes(1));

    await act(async () => observador(utilizadorCom('token-1')));
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledTimes(1));

    await act(async () => observador(utilizadorCom('token-2')));
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledTimes(2));
    expect(mockedCreateSession).toHaveBeenLastCalledWith('token-2');
  });

  test('não tenta criar sessão quando não há utilizador', async () => {
    const obterObservador = capturarObservador();
    render(
      <AuthProvider>
        <EstadoProbe />
      </AuthProvider>,
    );

    await act(async () => obterObservador()(null));

    expect(await screen.findByText('sem sessão')).toBeVisible();
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  test('uma falha do servidor não desliga a sessão do cliente', async () => {
    const obterObservador = capturarObservador();
    mockedCreateSession.mockRejectedValueOnce(new Error('servidor em baixo'));
    render(
      <AuthProvider>
        <EstadoProbe />
      </AuthProvider>,
    );

    const observador = obterObservador();
    await act(async () => observador(utilizadorCom('token-1')));
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('com sessão')).toBeVisible();

    // A renovação seguinte volta a tentar, mesmo com o mesmo token.
    await act(async () => observador(utilizadorCom('token-1')));
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledTimes(2));
  });
});
