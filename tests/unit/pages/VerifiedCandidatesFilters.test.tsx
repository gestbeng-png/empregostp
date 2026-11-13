import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import type { VerifiedCandidate } from '../../../components/home/VerifiedCandidatesCarousel';
import VerifiedCandidatesPage from '../../../pages/verificados';

jest.mock('../../../lib/firebaseAdmin', () => ({ admin: {} }));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const candidates: VerifiedCandidate[] = [
  {
    id: 'ana',
    fullName: 'Ana Graça',
    headline: 'Informática',
    experienceLabel: 'Anos de experiência: 2 anos',
    initials: 'AG',
    profileVisibility: 'public',
  },
  {
    id: 'bruno',
    fullName: 'Bruno Lima',
    headline: 'Hotelaria',
    experienceLabel: 'Anos de experiência: 6 anos',
    initials: 'BL',
    profileVisibility: 'public',
  },
  {
    id: 'carla',
    fullName: 'Carla Neves',
    headline: 'Informática',
    experienceLabel: 'Perfil profissional verificado',
    initials: 'CN',
    profileVisibility: 'recruiters',
  },
];

test('mostra categorias reais, contagem e campos acessíveis, sem duplicar o main', () => {
  render(<VerifiedCandidatesPage candidates={candidates} />);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  const search = screen.getByRole('search', { name: 'Filtrar talentos' });
  expect(
    within(search).getByRole('combobox', { name: 'Categoria' }),
  ).toBeVisible();
  expect(
    within(search).getByRole('combobox', { name: 'Experiência' }),
  ).toBeVisible();
  expect(
    screen.getByRole('searchbox', { name: 'Pesquisar talentos' }),
  ).toBeVisible();
  expect(
    screen.getByRole('option', { name: 'Informática (2)' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    '3 talentos encontrados',
  );
  expect(
    screen.queryByRole('button', { name: 'Limpar filtros' }),
  ).not.toBeInTheDocument();
});

test('filtra por categoria e experiência em conjunto e permite limpar tudo', async () => {
  const user = userEvent.setup();
  render(<VerifiedCandidatesPage candidates={candidates} />);
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Categoria' }),
    'informatica',
  );
  expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    '2 talentos encontrados de 3',
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Experiência' }),
    '0-2',
  );
  expect(screen.getByText('Ana Graça')).toBeVisible();
  expect(screen.queryByText('Carla Neves')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    '1 talento encontrado de 3',
  );
  await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Experiência' })).toHaveValue('');
  expect(screen.getByText('Bruno Lima')).toBeVisible();
  expect(screen.getByText('Carla Neves')).toBeVisible();
});

test('pesquisa sem acentos e mostra uma recuperação útil quando não há resultados', async () => {
  const user = userEvent.setup();
  render(<VerifiedCandidatesPage candidates={candidates} />);
  const input = screen.getByRole('searchbox', { name: 'Pesquisar talentos' });
  await user.type(input, 'ana graca');
  expect(screen.getByText('Ana Graça')).toBeVisible();
  expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument();
  await user.clear(input);
  await user.type(input, 'categoria sem resultado');
  expect(screen.getByRole('status')).toHaveTextContent(
    '0 talentos encontrados de 3',
  );
  expect(
    screen.getByRole('heading', {
      name: 'Nenhum talento corresponde aos filtros',
    }),
  ).toBeVisible();
  expect(
    screen.queryByText('O próximo perfil em destaque pode ser o seu'),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Ver todos os talentos' }),
  );
  expect(input).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent(
    '3 talentos encontrados',
  );
});

test('mantém os links e a privacidade dos cartões existentes', async () => {
  const user = userEvent.setup();
  render(<VerifiedCandidatesPage candidates={candidates} />);
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Categoria' }),
    'informatica',
  );
  expect(
    screen.getByRole('link', { name: 'Ver perfil de Ana Graça' }),
  ).toHaveAttribute('href', '/candidatos/ana');
  expect(
    screen.getByRole('link', {
      name: 'Iniciar sessão de empresa para ver o perfil de Carla Neves',
    }),
  ).toHaveAttribute('href', '/login?redirect=%2Fcandidatos%2Fcarla');
});

test('preserva o estado vazio original quando ainda não há verificados', () => {
  render(<VerifiedCandidatesPage candidates={[]} />);
  expect(
    screen.getByRole('heading', {
      name: 'O próximo perfil em destaque pode ser o seu',
    }),
  ).toBeVisible();
  expect(screen.getByRole('link', { name: 'Seja verificado' })).toHaveAttribute(
    'href',
    '/candidatos#planos',
  );
});
