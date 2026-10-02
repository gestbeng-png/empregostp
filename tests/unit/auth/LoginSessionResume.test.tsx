import { act, render, screen, waitFor } from '@testing-library/react';
import { onIdTokenChanged } from 'firebase/auth';

import { createServerSession } from '../../../lib/authSessionClient';
import Login from '../../../pages/login';

const routerQuery: { redirect?: string } = {};
const replaceMock = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ query: routerQuery, replace: replaceMock }),
}));

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  onIdTokenChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn() }));
jest.mock('../../../lib/firebaseAuth', () => ({
  __esModule: true,
  default: { signOut: jest.fn() },
}));
jest.mock('../../../lib/firebase', () => ({ db: {} }));
jest.mock('../../../lib/authSessionClient', () => ({
  createServerSession: jest.fn(),
  destroyServerSession: jest.fn(),
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

const utilizadorGuardado = {
  uid: 'candidate-1',
  getIdToken: jest.fn().mockResolvedValue('token-guardado'),
};

describe('retoma da sessão guardada no login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    delete routerQuery.redirect;
    mockedCreateSession.mockResolvedValue(undefined);
  });

  test('recria o cookie e segue para o destino pedido, sem escrever a senha', async () => {
    routerQuery.redirect = '/dashboard/candidato/vagas';
    const obterObservador = capturarObservador();
    render(<Login />);

    await act(async () => obterObservador()(utilizadorGuardado));

    await waitFor(() =>
      expect(mockedCreateSession).toHaveBeenCalledWith('token-guardado'),
    );
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/candidato/vagas');
  });

  test('sem destino pedido, vai para o painel', async () => {
    const obterObservador = capturarObservador();
    render(<Login />);

    await act(async () => obterObservador()(utilizadorGuardado));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'));
  });

  test('um destino externo não é seguido', async () => {
    routerQuery.redirect = '//atacante.example';
    const obterObservador = capturarObservador();
    render(<Login />);

    await act(async () => obterObservador()(utilizadorGuardado));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'));
  });

  test('não retoma duas vezes seguidas: evita o ciclo de recarregamentos', async () => {
    const obterObservador = capturarObservador();
    const { unmount } = render(<Login />);
    await act(async () => obterObservador()(utilizadorGuardado));
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledTimes(1));
    unmount();

    // O destino devolveu-nos ao login: a segunda visita mostra o formulário.
    const obterSegundoObservador = capturarObservador();
    render(<Login />);
    await act(async () => obterSegundoObservador()(utilizadorGuardado));

    expect(mockedCreateSession).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Senha')).toBeVisible();
  });

  test('sem sessão guardada, mostra o formulário', async () => {
    const obterObservador = capturarObservador();
    render(<Login />);

    await act(async () => obterObservador()(null));

    expect(mockedCreateSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toBeVisible();
  });
});
