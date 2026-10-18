import { render, screen, within } from '@testing-library/react';

import EmpresasPage, { getServerSideProps } from '../../../pages/empresas';

const mockFetchActiveEmpresaPlans = jest.fn();

jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { firestore: jest.fn() },
}));

jest.mock('../../../lib/empresaPlansCatalog', () => {
  const actual = jest.requireActual('../../../lib/empresaPlansCatalog');
  return {
    ...actual,
    fetchEmpresaPlans: (...args: unknown[]) =>
      mockFetchActiveEmpresaPlans(...args),
  };
});

const firestorePlans = [
  {
    id: 'empresa-basic-real',
    type: 'empresa',
    name: 'Essencial',
    price: 0,
    priceLabel: 'Grátis',
    duration: 30,
    vagasLimit: 1,
    description: 'Para começar a recrutar sem custos.',
    features: ['1 vaga ativa', 'Gestão de candidaturas'],
    isActive: true,
  },
  {
    id: 'empresa-profissional-real',
    type: 'empresa',
    name: 'Profissional',
    price: 375,
    priceLabel: '375 Dobras',
    duration: 30,
    vagasLimit: 5,
    destaque: true,
    popular: true,
    description: 'Para equipas com recrutamento recorrente.',
    features: [
      'Benefício 1',
      'Benefício 2',
      'Benefício 3',
      'Benefício 4',
      'Benefício 5',
      'Benefício 6',
      'Benefício 7',
      'Analytics completos',
    ],
    isActive: true,
  },
  {
    id: 'empresa-pro-real',
    type: 'empresa',
    name: 'PRO',
    price: 950,
    priceLabel: '950 Dobras/mês',
    duration: 30,
    vagasLimit: null,
    description: 'Operação completa para recrutamento em escala.',
    features: ['Vagas ilimitadas', 'Banco de talentos completo'],
    isActive: true,
  },
];

describe('planos públicos para empresas', () => {
  beforeEach(() => {
    mockFetchActiveEmpresaPlans.mockReset();
  });

  test('usa no servidor os planos empresariais ativos da mesma fonte do dashboard', async () => {
    mockFetchActiveEmpresaPlans.mockResolvedValue(firestorePlans);

    const result = await getServerSideProps();
    const companyPlans = result.props.companyPlans;

    expect(mockFetchActiveEmpresaPlans).toHaveBeenCalledTimes(1);
    // O Essencial ainda não existe no Firestore: entra com os valores padrão.
    // O plano gratuito chamado «Essencial» continua a ser o escalão básico.
    expect(companyPlans).toHaveLength(4);
    expect(companyPlans.map((plan: { price: number }) => plan.price)).toEqual([
      0, 250, 375, 950,
    ]);
    expect(companyPlans[0]).toMatchObject({ id: 'basic_empresa' });
    expect(companyPlans[1]).toMatchObject({
      id: 'essential_empresa',
      name: 'Essencial',
      priceLabel: '250 STD',
    });
    expect(companyPlans[2]).toMatchObject({
      id: 'professional_empresa',
      sourcePlanId: 'empresa-profissional-real',
      name: 'Profissional',
      priceLabel: '375 Dobras',
    });
  });

  test('mostra publicamente o mesmo preço, descrição e benefícios reais', async () => {
    mockFetchActiveEmpresaPlans.mockResolvedValue(firestorePlans);
    const result = await getServerSideProps();

    render(<EmpresasPage companyPlans={result.props.companyPlans} />);

    const plansSection = screen
      .getByRole('heading', { name: 'Planos para empresas' })
      .closest('section');
    expect(plansSection).not.toBeNull();

    const professionalCard = within(plansSection as HTMLElement)
      .getByRole('heading', { name: 'Profissional' })
      .closest('article');
    expect(professionalCard).not.toBeNull();

    const card = within(professionalCard as HTMLElement);
    expect(card.getByText('375 Dobras')).toBeVisible();
    expect(card.getByText('por mês')).toBeVisible();
    expect(
      card.getByText('Para equipas com recrutamento recorrente.'),
    ).toBeVisible();
    expect(card.getByText('Analytics completos')).toBeVisible();
    expect(card.queryByText('Relatórios completos')).not.toBeInTheDocument();
    expect(card.getByText('Mais escolhido')).toBeVisible();

    const proCard = within(plansSection as HTMLElement)
      .getByRole('heading', { name: 'PRO' })
      .closest('article');
    expect(proCard).not.toBeNull();
    expect(
      within(proCard as HTMLElement).queryByText('por mês'),
    ).not.toBeInTheDocument();
  });
});
