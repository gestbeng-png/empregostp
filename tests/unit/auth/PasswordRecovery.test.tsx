import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import type { ReactNode } from 'react';

import RecuperarSenha from '../../../pages/recuperar-senha';
import RedefinirSenha from '../../../pages/redefinir-senha';

jest.mock('firebase/auth', () => ({
  confirmPasswordReset: jest.fn(),
  verifyPasswordResetCode: jest.fn(),
}));

jest.mock('../../../lib/firebaseAuth', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: { oobCode: 'valid-code' },
  }),
}));

jest.mock('../../../components/auth/AuthShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const mockedVerifyPasswordResetCode = jest.mocked(verifyPasswordResetCode);
const mockedConfirmPasswordReset = jest.mocked(confirmPasswordReset);

describe('recuperação e redefinição de senha', () => {
  test('apresenta o estado de email enviado sem revelar contas existentes', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    render(<RecuperarSenha />);
    await user.type(screen.getByLabelText('Email'), 'Pessoa@Example.com');
    await user.click(
      screen.getByRole('button', { name: 'Enviar link de recuperação' }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Verifique o seu email',
      }),
    ).toBeVisible();
    expect(screen.getByText('pessoa@example.com')).toBeVisible();
  });

  test('rejeita uma senha fraca com as mesmas regras do registo', async () => {
    const user = userEvent.setup();
    mockedVerifyPasswordResetCode.mockResolvedValue('pessoa@example.com');

    render(<RedefinirSenha />);
    await screen.findByRole('heading', { level: 1, name: 'Criar nova senha' });

    await user.type(screen.getByLabelText('Nova senha'), 'abcdef');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'abcdef');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(
      screen.getByText(/A senha deve ter pelo menos 8 caracteres/),
    ).toBeVisible();
    expect(mockedConfirmPasswordReset).not.toHaveBeenCalled();
  });

  test('confirma uma senha forte e apresenta o estado concluído', async () => {
    const user = userEvent.setup();
    mockedVerifyPasswordResetCode.mockResolvedValue('pessoa@example.com');
    mockedConfirmPasswordReset.mockResolvedValue(undefined);

    render(<RedefinirSenha />);
    await screen.findByRole('heading', { level: 1, name: 'Criar nova senha' });

    await user.type(screen.getByLabelText('Nova senha'), 'SenhaForte1!');
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'SenhaForte1!',
    );
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() =>
      expect(mockedConfirmPasswordReset).toHaveBeenCalledWith(
        {},
        'valid-code',
        'SenhaForte1!',
      ),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Senha alterada' }),
    ).toBeVisible();
  });
});
