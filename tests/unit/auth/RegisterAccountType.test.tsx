import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

jest.mock('../../../lib/firebaseAuth', () => ({
  __esModule: true,
  default: { signOut: jest.fn() },
}));

jest.mock('../../../lib/firestore', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('nookies', () => ({
  set: jest.fn(),
}));

describe('formulário de registo por tipo de conta', () => {
  beforeEach(() => {
    mockRouter.query = {};
  });

  test('começa pela escolha explícita do tipo de conta', () => {
    render(<Register />);

    expect(screen.getByText('Tipo de conta')).toBeVisible();
    expect(screen.getByLabelText(/Sou um candidato/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Sou uma empresa/i)).not.toBeChecked();
    expect(screen.queryByLabelText('Nome completo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome da empresa')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Selecione o tipo de conta' }),
    ).toBeDisabled();
  });

  test('apresenta apenas os campos adequados ao candidato', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await user.click(screen.getByLabelText(/Sou um candidato/i));

    expect(
      screen.getByRole('heading', { name: 'Dados do candidato' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Nome completo')).toBeRequired();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Senha')).toBeRequired();
    expect(screen.queryByLabelText('NIF da empresa')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Criar conta de candidato' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: /Continuar como candidato com Google/i,
      }),
    ).toBeEnabled();
  });

  test('apresenta os dados empresariais obrigatórios ao escolher empresa', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await user.click(screen.getByLabelText(/Sou uma empresa/i));

    expect(
      screen.getByRole('heading', { name: 'Dados da empresa' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Nome da empresa')).toBeRequired();
    expect(screen.getByLabelText('Email profissional')).toBeRequired();
    expect(screen.getByLabelText('Telefone de contacto')).toBeRequired();
    expect(screen.getByLabelText('NIF da empresa')).toBeRequired();
    expect(screen.getByLabelText('Setor de atividade')).toBeRequired();
    expect(screen.getByLabelText('Localização')).toBeRequired();
    expect(
      screen.getByRole('button', { name: 'Criar conta da empresa' }),
    ).toBeEnabled();
  });

  test('exige os dados empresariais antes do registo com Google', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await user.click(screen.getByLabelText(/Sou uma empresa/i));
    await user.click(
      screen.getByRole('button', {
        name: /Continuar como empresa com Google/i,
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Introduza o nome da empresa.',
    );
  });

  test.each(['candidato', 'candidate'])(
    'pré-seleciona o candidato para o parâmetro %s',
    async (type) => {
      mockRouter.query = { type };
      render(<Register />);

      await waitFor(() =>
        expect(screen.getByLabelText(/Sou um candidato/i)).toBeChecked(),
      );
      expect(screen.getByLabelText('Nome completo')).toBeVisible();
    },
  );

  test('pré-seleciona a empresa a partir do endereço', async () => {
    mockRouter.query = { type: 'empresa' };
    render(<Register />);

    await waitFor(() =>
      expect(screen.getByLabelText(/Sou uma empresa/i)).toBeChecked(),
    );
    expect(screen.getByLabelText('Nome da empresa')).toBeVisible();
    expect(screen.getByLabelText('NIF da empresa')).toBeVisible();
  });
});
