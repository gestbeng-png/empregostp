import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import NotFoundPage from '../../../pages/404';

jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => (
    <main id="main-content">{children}</main>
  ),
}));

test('explica o erro com um único título e sem expor a ilustração aos leitores de ecrã', () => {
  const { container } = render(<NotFoundPage />);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Esta página não está por aqui.',
    }),
  ).toBeVisible();
  expect(screen.getByText('Página não encontrada')).toBeVisible();
  expect(screen.getByText(/O endereço pode estar incorreto/)).toBeVisible();
  expect(container.querySelector('.illustration')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
});

test('permite recuperar para o início e as vagas sem depender de voltar no histórico', () => {
  render(<NotFoundPage />);
  expect(
    screen.getByRole('link', { name: 'Voltar ao início' }),
  ).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Explorar vagas' })).toHaveAttribute(
    'href',
    '/vagas',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('oferece caminhos válidos para candidatos, empresas e apoio', () => {
  render(<NotFoundPage />);
  const shortcuts = screen.getByRole('navigation', { name: 'Outros caminhos' });
  expect(
    within(shortcuts).getByRole('link', { name: 'Para candidatos' }),
  ).toHaveAttribute('href', '/candidatos');
  expect(
    within(shortcuts).getByRole('link', { name: 'Para empresas' }),
  ).toHaveAttribute('href', '/empresas');
  expect(
    screen.getByRole('link', { name: 'Precisa de ajuda? Fale connosco' }),
  ).toHaveAttribute('href', '/contacto');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});
