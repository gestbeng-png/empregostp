import { render, screen } from '@testing-library/react';
import { applyActionCode } from 'firebase/auth';

import VerificarEmail from '../../../pages/verificar-email';

const mockRouter = {
  isReady: true,
  query: { oobCode: 'test-code', returnTo: '/vaga/abc#candidatura' },
};
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('firebase/auth', () => ({ applyActionCode: jest.fn() }));
jest.mock('../../../lib/firebaseAuth', () => ({
  __esModule: true,
  default: {},
}));

test('a confirmação mantém o destino sem afirmar que a conta está ativa', async () => {
  jest.mocked(applyActionCode).mockResolvedValue(undefined);
  render(<VerificarEmail />);
  expect(await screen.findByText('Email confirmado')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Iniciar sessão' })).toHaveAttribute(
    'href',
    '/login?redirect=%2Fvaga%2Fabc%23candidatura',
  );
  expect(screen.queryByText(/conta foi ativada/)).not.toBeInTheDocument();
});

test('uma confirmação recusada não mostra sucesso e permite recuperar o percurso', async () => {
  jest.mocked(applyActionCode).mockRejectedValue(new Error('expired'));
  render(<VerificarEmail />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Link inválido ou expirado',
  );
  expect(screen.queryByText('Email confirmado')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Iniciar sessão' })).toHaveAttribute(
    'href',
    '/login?redirect=%2Fvaga%2Fabc%23candidatura',
  );
});
