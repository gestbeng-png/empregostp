import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import CandidatePremiumPlansExperience from '../../../components/CandidatePremiumPlansExperience';
import EmpresaPlansCatalog from '../../../components/EmpresaPlansCatalog';
import ManualPaymentProofCard from '../../../components/ManualPaymentProofCard';

const router = { push: jest.fn() };
const onSubscribe = jest.fn();
const fetchMock = jest.fn();
let mockConfig = { loading: false, onlineEnabled: true };
jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('firebase/auth', () => ({
  getAuth: () => ({
    currentUser: { getIdToken: async () => 'synthetic-token' },
  }),
}));
jest.mock('../../../components/payments/StripeReturnNotice', () => () => null);
jest.mock('../../../components/payments/useOnlinePaymentConfig', () => ({
  __esModule: true,
  default: () => mockConfig,
}));

const instructions = {
  amount: 100,
  currency: 'Dobras',
  accountNumber: 'TEST-BANK-123',
  accountName: 'Titular de teste',
  bankName: 'Banco de teste',
  email: 'pagamentos@example.test',
  message: 'Instruções apenas para transferência.',
};
const request = {
  id: 'synthetic-request',
  planId: 'configured-plan',
  planName: 'Plano de teste',
  price: 100,
  status: 'pending',
  paymentInstructions: instructions,
};
const plan = {
  id: 'configured-plan',
  planTierId: 'professional_candidato',
  name: 'Plano de teste',
  type: 'candidato',
  price: 100,
  priceLabel: '100 Dobras',
  features: [],
};

function CompanyHarness() {
  const [pending, setPending] = useState<typeof request | null>(null);
  return (
    <EmpresaPlansCatalog
      plans={[
        {
          ...plan,
          name: 'Profissional',
          type: 'empresa',
          planTierId: 'professional_empresa',
        },
      ]}
      pendingPaymentRequest={pending}
      paymentInstructions={instructions}
      onSubscribe={async (planId: string) => {
        onSubscribe(planId);
        setPending(request);
        return { status: 'awaiting_payment' };
      }}
    />
  );
}

async function openPlan(role: string) {
  render(
    role === 'candidato' ? (
      <CandidatePremiumPlansExperience
        embedded
        onPlanApproved={jest.fn()}
        onOpenVerification={jest.fn()}
      />
    ) : (
      <CompanyHarness />
    ),
  );
  const card = await screen.findByRole('article', {
    name: role === 'candidato' ? 'Plano de teste' : 'Profissional',
  });
  await userEvent.click(
    within(card).getByRole('button', {
      name: role === 'candidato' ? 'Assinar plano' : 'Escolher plano',
    }),
  );
  return screen.getByRole('dialog');
}
function confirm(role: string) {
  return screen.getByRole('button', {
    name: role === 'candidato' ? 'Confirmar' : 'Confirmar plano',
  });
}
function expectNoBankDetails() {
  expect(
    screen.queryByText(instructions.accountNumber, { exact: false }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(instructions.accountName, { exact: false }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(instructions.bankName, { exact: false }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(instructions.email, { exact: false }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(instructions.message, { exact: false }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Ficheiro')).not.toBeInTheDocument();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig = { loading: false, onlineEnabled: true };
  global.fetch = fetchMock;
  fetchMock.mockImplementation(async (url) => ({
    ok: true,
    json: async () => {
      if (url === '/api/profile')
        return { profile: { data: { currentPlan: 'basic_candidato' } } };
      if (url === '/api/candidate/plans') return { plans: [plan] };
      if (url === '/api/admin/payment-settings')
        return { ...instructions, instructions: instructions.message };
      if (url === '/api/subscribe-plan') {
        onSubscribe(plan.id);
        return {
          status: 'awaiting_payment',
          requestId: request.id,
          paymentInstructions: instructions,
        };
      }
      return {};
    },
  }));
});

test.each(['candidato', 'empresa'])(
  '%s: primeiro escolhe o método, só depois recebe os dados bancários',
  async (role) => {
    const dialog = await openPlan(role);
    expect(
      within(dialog).getByRole('radiogroup', { name: 'Forma de pagamento' }),
    ).toBeVisible();
    expect(confirm(role)).toBeDisabled();
    expect(onSubscribe).not.toHaveBeenCalled();
    expectNoBankDetails();
    await userEvent.click(
      screen.getByRole('radio', { name: /Transferência bancária/ }),
    );
    expect(confirm(role)).toBeEnabled();
    expectNoBankDetails();
    await userEvent.click(confirm(role));
    expect(await screen.findByLabelText('Ficheiro')).toBeVisible();
    expect(
      screen.getByText(instructions.accountNumber, { exact: false }),
    ).toBeVisible();
    expect(
      screen.getByRole('radio', { name: /Transferência bancária/ }),
    ).toBeChecked();
    expect(onSubscribe).toHaveBeenCalledTimes(1);
  },
);

test.each(['candidato', 'empresa'])(
  '%s: pagamento online não mostra transferência nem pede comprovativo',
  async (role) => {
    await openPlan(role);
    await userEvent.click(
      screen.getByRole('radio', { name: /Cartão ou PayPal/ }),
    );
    await userEvent.click(confirm(role));
    expect(
      await screen.findByRole('button', { name: /^Pagar / }),
    ).toBeVisible();
    expectNoBankDetails();
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    // Pode corrigir a escolha sem criar um segundo pedido.
    await userEvent.click(
      screen.getByRole('radio', { name: /Transferência bancária/ }),
    );
    expect(screen.getByLabelText('Ficheiro')).toBeVisible();
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole('radio', { name: /Cartão ou PayPal/ }),
    );
    expectNoBankDetails();
  },
);

test('uma configuração online lenta não mostra dados manuais temporariamente', async () => {
  mockConfig = { loading: true, onlineEnabled: false };
  const view = render(<ManualPaymentProofCard request={request} />);
  expect(screen.getByText('A carregar formas de pagamento…')).toBeVisible();
  expectNoBankDetails();
  mockConfig = { loading: false, onlineEnabled: true };
  view.rerender(<ManualPaymentProofCard request={request} />);
  expectNoBankDetails();
  await userEvent.click(
    screen.getByRole('radio', { name: /Cartão ou PayPal/ }),
  );
  expectNoBankDetails();
});

test('mesmo sem Stripe disponível, a transferência precisa de ser escolhida', async () => {
  mockConfig = { loading: false, onlineEnabled: false };
  render(<ManualPaymentProofCard request={request} />);
  expectNoBankDetails();
  expect(
    screen.queryByRole('radio', { name: /Cartão ou PayPal/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('radio', { name: /Transferência bancária/ }),
  );
  expect(screen.getByLabelText('Ficheiro')).toBeVisible();
});

test('uma falha online não expõe dados manuais, mas permite mudar de método', async () => {
  render(<ManualPaymentProofCard request={request} initialMethod="online" />);
  fetchMock.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: 'Checkout indisponível' }),
  });
  await userEvent.click(screen.getByRole('button', { name: /^Pagar / }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Checkout indisponível',
  );
  expectNoBankDetails();
  await userEvent.click(
    screen.getByRole('radio', { name: /Transferência bancária/ }),
  );
  expect(screen.getByLabelText('Ficheiro')).toBeVisible();
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
});
