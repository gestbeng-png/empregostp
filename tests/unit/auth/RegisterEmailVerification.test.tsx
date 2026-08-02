import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUserWithEmailAndPassword } from 'firebase/auth';

import Register from '../../../pages/register';

const mockRouter = {
  query: {} as Record<string, string>,
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
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

const signOutMock = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../lib/firebaseAuth', () => ({
  __esModule: true,
  default: { signOut: () => signOutMock() },
}));

jest.mock('../../../lib/firestore', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('nookies', () => ({
  set: jest.fn(),
}));

const mockedCreateUser = jest.mocked(createUserWithEmailAndPassword);

async function fillCandidateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Sou um candidato/i));
  await user.type(screen.getByLabelText('Nome completo'), 'Maria Graça');
  await user.type(screen.getByLabelText('Email'), 'maria@example.test');
  await user.type(screen.getByLabelText('Senha'), 'SenhaForte1!');
}

describe('confirmação de email após o registo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.query = {};
    mockedCreateUser.mockResolvedValue({
      user: { getIdToken: () => Promise.resolve('id-token') },
    } as never);
  });

  test('mostra o ecrã de confirmação quando o email é enviado com sucesso', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as typeof fetch;
    const user = userEvent.setup();
    render(<Register />);
    await fillCandidateForm(user);

    await user.click(
      screen.getByRole('button', { name: 'Criar conta de candidato' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Confirme o seu email')).toBeVisible(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  test('não afirma ter enviado o email quando a rota responde com falha', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (String(url).includes('send-verification')) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return Promise.resolve({ ok: true, status: 200 });
    }) as typeof fetch;
    const user = userEvent.setup();
    render(<Register />);
    await fillCandidateForm(user);

    await user.click(
      screen.getByRole('button', { name: 'Criar conta de candidato' }),
    );

    // A conta existe e o próximo passo continua a ser confirmar o email,
    // mas a app já não pode fingir que o envio foi bem-sucedido.
    await waitFor(() =>
      expect(screen.getByText('Confirme o seu email')).toBeVisible(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Não foi possível enviar o email de confirmação/i,
    );
    expect(
      screen.getByRole('button', { name: /Reenviar email/i }),
    ).toBeEnabled();
  });

  test('não afirma ter enviado o email quando o pedido falha por erro de rede', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (String(url).includes('send-verification')) {
        return Promise.reject(new Error('network down'));
      }
      return Promise.resolve({ ok: true, status: 200 });
    }) as typeof fetch;
    const user = userEvent.setup();
    render(<Register />);
    await fillCandidateForm(user);

    await user.click(
      screen.getByRole('button', { name: 'Criar conta de candidato' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Confirme o seu email')).toBeVisible(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Não foi possível enviar o email de confirmação/i,
    );
  });

  test('uma falha depois de criar a conta não é relatada como "não foi possível criar a conta"', async () => {
    // setup-user e o encerramento de sessão podem falhar sem que isso negue
    // que a conta em si foi criada com sucesso no Firebase Auth.
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as typeof fetch;
    signOutMock.mockRejectedValueOnce(new Error('sign-out failed'));
    const user = userEvent.setup();
    render(<Register />);
    await fillCandidateForm(user);

    await user.click(
      screen.getByRole('button', { name: 'Criar conta de candidato' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Confirme o seu email')).toBeVisible(),
    );
    expect(screen.queryByText('Não foi possível criar a conta. Tente novamente.')).not.toBeInTheDocument();
  });

  test('uma falha real na criação da conta continua a mostrar o erro específico', async () => {
    mockedCreateUser.mockRejectedValue({ code: 'auth/email-already-in-use' });
    const user = userEvent.setup();
    render(<Register />);
    await fillCandidateForm(user);

    await user.click(
      screen.getByRole('button', { name: 'Criar conta de candidato' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este email já está em uso.',
    );
    expect(screen.queryByText('Confirme o seu email')).not.toBeInTheDocument();
  });
});
