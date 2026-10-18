import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import VagasPage, { getServerSideProps } from '../../../pages/vagas';

const mockRouter = {
  query: {} as Record<string, string | undefined>,
  pathname: '/vagas',
  replace: jest.fn(),
  reload: jest.fn(),
};
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    firestore: () => {
      throw new Error('database unavailable');
    },
  },
}));

beforeEach(() => {
  mockRouter.query = {};
  Element.prototype.scrollIntoView = jest.fn();
});

// Fixtures isoladas de teste: nenhum dado é escrito no Firebase ou no produto.
const jobs = [
  {
    id: '1',
    titulo: 'Contabilista',
    localizacao: 'São Tomé',
    categoria: 'Finanças',
    empresaNome: 'Organização de teste',
    status: 'active',
  },
  {
    id: '2',
    titulo: 'Técnico',
    localizacao: 'Príncipe',
    categoria: 'Tecnologia',
    empresaNome: 'Organização de teste',
    status: 'active',
  },
];

test.each([
  { q: 'Contabilista', loc: 'São Tomé', cat: 'Finanças' },
  { search: 'Contabilista', local: 'São Tomé', categoria: 'Finanças' },
])('aceita pesquisas existentes e aliases do wireframe: %j', (query) => {
  mockRouter.query = query;
  render(<VagasPage initialJobs={jobs as never[]} />);
  expect(
    screen.getByPlaceholderText('Cargo, palavra-chave ou empresa'),
  ).toHaveValue('Contabilista');
  expect(screen.getByPlaceholderText('Localização (ex: São Tomé)')).toHaveValue(
    'São Tomé',
  );
  expect(screen.getByRole('heading', { name: 'Contabilista' })).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Técnico' }),
  ).not.toBeInTheDocument();
});

const manyJobs = Array.from({ length: 13 }, (_, index) => ({
  ...jobs[0],
  id: String(index + 1),
  titulo: `Vaga ${index + 1}`,
}));

test('a página pedida no URL é preservada e acompanha o histórico', async () => {
  mockRouter.query = { page: '2' };
  const { rerender } = render(<VagasPage initialJobs={manyJobs as never[]} />);
  expect(
    screen.getByRole('heading', { name: 'Vaga 7' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Vaga 1' }),
  ).not.toBeInTheDocument();
  mockRouter.query = { page: '3' };
  rerender(<VagasPage initialJobs={manyJobs as never[]} />);
  expect(
    await screen.findByRole('heading', { name: 'Vaga 13' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Vaga 7' }),
  ).not.toBeInTheDocument();
});

test('mudar de página escreve o URL e pesquisar repõe a primeira página', async () => {
  const user = userEvent.setup();
  render(<VagasPage initialJobs={manyJobs as never[]} />);
  await user.click(screen.getByRole('button', { name: 'Página seguinte' }));
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenLastCalledWith(
      { pathname: '/vagas', query: { page: '2' } },
      undefined,
      { shallow: true, scroll: false },
    ),
  );
  await user.type(
    screen.getByPlaceholderText('Cargo, palavra-chave ou empresa'),
    'Vaga 13',
  );
  expect(
    screen.getByRole('heading', { name: 'Vaga 13' }),
  ).toBeVisible();
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenLastCalledWith(
      { pathname: '/vagas', query: { search: 'Vaga 13' } },
      undefined,
      { shallow: true, scroll: false },
    ),
  );
});

test.each(['-1', '1.5', 'inválido', '999999999999999999999'])(
  'uma página inválida %s não esvazia os resultados',
  (page) => {
    mockRouter.query = { page };
    render(<VagasPage initialJobs={manyJobs as never[]} />);
    expect(
      screen.getByRole('heading', { name: 'Vaga 1' }),
    ).toBeVisible();
  },
);

test('página além dos resultados usa a última página disponível', () => {
  mockRouter.query = { page: '99' };
  render(<VagasPage initialJobs={manyJobs as never[]} />);
  expect(
    screen.getByRole('heading', { name: 'Vaga 13' }),
  ).toBeVisible();
});

test('uma falha do servidor não é apresentada como ausência de vagas e permite repetir', async () => {
  const user = userEvent.setup();
  render(<VagasPage loadFailed />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Não foi possível carregar as vagas.',
  );
  expect(
    screen.queryByText('Nenhuma vaga combina com os filtros atuais'),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(mockRouter.reload).toHaveBeenCalledTimes(1);
});

test('a falha de leitura devolve 503 sem cache nem detalhe técnico no cliente', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const res = { statusCode: 200, setHeader: jest.fn() };
  try {
    const result = await getServerSideProps({ res });
    expect(res.statusCode).toBe(503);
    expect(res.setHeader).toHaveBeenLastCalledWith('Cache-Control', 'no-store');
    expect(result.props).toMatchObject({ initialJobs: [], loadFailed: true });
    expect(JSON.stringify(result)).not.toContain('database unavailable');
  } finally {
    log.mockRestore();
  }
});
