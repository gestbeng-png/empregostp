import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CandidatePremiumPlansExperience from '../../../components/CandidatePremiumPlansExperience';

const router = { push: jest.fn() };
jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'test-token' } }),
}));
jest.mock('../../../components/payments/StripeReturnNotice', () => () => null);
jest.mock(
  '../../../components/ManualPaymentProofCard',
  () =>
    function ProofCard({ request }: { request: { id: string } }) {
      return <div data-testid="payment-proof">Pedido {request.id}</div>;
    },
);

const plans = [
  {
    id: 'configured-pro',
    planTierId: 'professional_candidato',
    name: 'Profissional configurado',
    price: 75,
    priceLabel: '75 Dobras',
    summary: 'Ferramentas para preparar as suas candidaturas.',
    popular: true,
    features: ['Assistente de carta', 'Estatísticas do perfil'],
  },
  {
    id: 'configured-premium',
    planTierId: 'unlimited_candidato',
    name: 'Premium configurado',
    price: 250,
    priceLabel: '250 STN',
    summary: 'Ferramentas profissionais com verificação incluída.',
    popular: false,
    features: ['Verificação incluída', 'Certificados ilimitados'],
  },
];
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => {
      if (url === '/api/profile')
        return { profile: { data: { currentPlan: 'basic_candidato' } } };
      if (url === '/api/candidate/plans') return { plans };
      if (url === '/api/admin/payment-settings')
        return { accountNumber: 'TEST-ACCOUNT' };
      if (url === '/api/subscribe-plan')
        return { status: 'awaiting_payment', requestId: 'test-request' };
      return {};
    },
  })) as jest.Mock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('apresenta os dados do admin em cartões com a ação antes dos benefícios', async () => {
  render(
    <CandidatePremiumPlansExperience
      embedded
      onPlanApproved={jest.fn()}
      onOpenVerification={jest.fn()}
    />,
  );
  await screen.findByRole('heading', {
    name: 'Profissional configurado',
    level: 2,
  });
  const region = screen.getByRole('region', { name: 'Planos disponíveis' });
  expect(within(region).getAllByRole('article')).toHaveLength(2);
  for (const plan of plans) {
    const card = screen.getByRole('article', { name: plan.name });
    expect(card).toHaveTextContent(plan.priceLabel);
    expect(card).toHaveTextContent(plan.summary);
    for (const feature of plan.features)
      expect(within(card).getByText(feature)).toBeVisible();
    const button = within(card).getByRole('button', { name: 'Assinar plano' });
    const benefits = within(card).getByRole('heading', {
      name: 'O que está incluído',
    });
    expect(
      button.compareDocumentPosition(benefits) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
  expect(
    within(
      screen.getByRole('article', { name: 'Profissional configurado' }),
    ).getByText('Popular'),
  ).toBeVisible();
});

test('a apresentação não altera o valor nem cria pedidos antes de confirmar', async () => {
  render(
    <CandidatePremiumPlansExperience
      embedded
      onPlanApproved={jest.fn()}
      onOpenVerification={jest.fn()}
    />,
  );
  const card = await screen.findByRole('article', {
    name: 'Premium configurado',
  });
  await userEvent.click(
    within(card).getByRole('button', { name: 'Assinar plano' }),
  );
  const modal = screen.getByRole('dialog');
  expect(within(modal).getByText('Premium configurado')).toBeVisible();
  expect(within(modal).getByText('250 STN')).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalledWith(
    '/api/subscribe-plan',
    expect.anything(),
  );
  await userEvent.click(
    within(modal).getByRole('button', { name: 'Cancelar' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('mantém o plano escolhido e o passo de pagamento após confirmação', async () => {
  render(
    <CandidatePremiumPlansExperience
      embedded
      onPlanApproved={jest.fn()}
      onOpenVerification={jest.fn()}
    />,
  );
  const card = await screen.findByRole('article', {
    name: 'Premium configurado',
  });
  await userEvent.click(
    within(card).getByRole('button', { name: 'Assinar plano' }),
  );
  await userEvent.click(
    await screen.findByRole('radio', { name: /Transferência bancária/ }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/subscribe-plan',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ planId: 'configured-premium' }),
      }),
    ),
  );
  expect(await screen.findByTestId('payment-proof')).toHaveTextContent(
    'test-request',
  );
});

test('mantém o plano atual desativado no novo cabeçalho', async () => {
  (global.fetch as jest.Mock).mockImplementation(async (url) => ({
    ok: true,
    json: async () =>
      url === '/api/profile'
        ? { profile: { data: { currentPlan: 'unlimited_candidato' } } }
        : url === '/api/candidate/plans'
          ? { plans }
          : {},
  }));
  render(
    <CandidatePremiumPlansExperience
      embedded
      onPlanApproved={jest.fn()}
      onOpenVerification={jest.fn()}
    />,
  );
  const card = await screen.findByRole('article', {
    name: 'Premium configurado',
  });
  expect(
    within(card).getByRole('button', { name: 'Plano atual' }),
  ).toBeDisabled();
  expect(within(card).getByText('O seu plano atual')).toBeVisible();
});

test('mostra a verificação incluída no Premium mesmo com benefícios personalizados pelo admin', async () => {
  const configuredPlans = plans.map((plan) => ({
    ...plan,
    features: ['Benefício personalizado pelo administrador'],
  }));
  (global.fetch as jest.Mock).mockImplementation(async (url) => ({
    ok: true,
    json: async () =>
      url === '/api/candidate/plans' ? { plans: configuredPlans } : {},
  }));

  render(
    <CandidatePremiumPlansExperience
      embedded
      onPlanApproved={jest.fn()}
      onOpenVerification={jest.fn()}
    />,
  );

  const premium = await screen.findByRole('article', {
    name: 'Premium configurado',
  });
  expect(
    within(premium).getByText('Verificação do perfil incluída'),
  ).toBeVisible();
  expect(
    within(premium).getByText('Benefício personalizado pelo administrador'),
  ).toBeVisible();
  expect(premium).toHaveTextContent('250 STN');
  expect(
    within(
      screen.getByRole('article', { name: 'Profissional configurado' }),
    ).queryByText('Verificação do perfil incluída'),
  ).not.toBeInTheDocument();
});
