import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CandidatePremiumPlansExperience from '../../../components/CandidatePremiumPlansExperience';

const router = { push: jest.fn() };
jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'test-token' } }),
}));
jest.mock('../../../components/payments/StripeReturnNotice', () => () => null);

const pendingRequest = {
  id: 'test-payment',
  planId: 'verification_candidato',
  planName: 'Verificação',
  price: 20,
  status: 'pending',
  paymentStatus: 'awaiting_proof',
};
const plans = [
  {
    id: 'professional_candidato',
    name: 'Profissional de teste',
    price: 50,
    priceLabel: '50 Dobras',
    features: [],
  },
];
const originalFetch = global.fetch;
let storedRequest: Record<string, unknown> | null;
let uploadFails: boolean;
const pendingJson = jest.fn();

beforeEach(() => {
  storedRequest = { ...pendingRequest };
  uploadFails = false;
  pendingJson
    .mockReset()
    .mockImplementation(async () => ({ request: storedRequest }));
  global.fetch = jest.fn(async (url) => {
    if (url === '/api/subscription-requests/current')
      return { ok: true, json: pendingJson };
    if (String(url).endsWith('/payment-proof')) {
      if (uploadFails)
        return {
          ok: false,
          json: async () => ({ error: 'Não foi possível enviar o ficheiro.' }),
        };
      storedRequest = {
        ...storedRequest,
        status: 'payment_submitted',
        paymentStatus: 'proof_submitted',
        paymentProof: {
          url: 'https://example.com/proof.pdf',
          name: 'transferencia.pdf',
          submittedAt: '2026-10-22T20:00:00Z',
        },
      };
      return { ok: true, json: async () => ({ request: storedRequest }) };
    }
    return {
      ok: true,
      json: async () =>
        url === '/api/profile'
          ? { profile: { data: { currentPlan: 'basic_candidato' } } }
          : url === '/api/candidate/plans'
            ? { plans }
            : { enabled: false },
    };
  }) as jest.Mock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

async function openPlans() {
  const result = render(
    <CandidatePremiumPlansExperience
      embedded
      onPlanApproved={jest.fn()}
      onOpenVerification={jest.fn()}
    />,
  );
  await screen.findByRole('heading', { name: 'Profissional de teste' });
  await waitFor(() => expect(pendingJson).toHaveBeenCalled());
  return result;
}

async function uploadProof() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Concluir pagamento' }),
  );
  await userEvent.click(
    await screen.findByRole('radio', { name: /Transferência bancária/ }),
  );
  await userEvent.upload(
    screen.getByLabelText('Ficheiro'),
    new File(['%PDF-1.4 test'], 'transferencia.pdf', {
      type: 'application/pdf',
    }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Enviar comprovativo' }),
  );
}

test('mostra o aviso apenas enquanto falta o comprovativo manual', async () => {
  await openPlans();
  expect(
    await screen.findByText('Pagamento pendente — Verificação'),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Concluir pagamento' }),
  ).toBeEnabled();
});

test('esconde o aviso e fecha o modal após enviar; não volta ao abrir os planos novamente', async () => {
  const view = await openPlans();
  await uploadProof();
  await screen.findByText(
    'Comprovativo enviado. Aguarde a análise do administrador.',
  );
  expect(
    screen.queryByRole('button', { name: 'Concluir pagamento' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Pagamento pendente — Verificação'),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(storedRequest?.status).toBe('payment_submitted');

  view.unmount();
  await openPlans();
  expect(screen.queryByText(/Pagamento pendente/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Concluir pagamento' }),
  ).not.toBeInTheDocument();
});

test('uma falha no envio mantém o aviso e permite tentar novamente', async () => {
  uploadFails = true;
  await openPlans();
  await uploadProof();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível enviar o ficheiro.',
  );
  expect(
    screen.getByRole('button', { name: 'Concluir pagamento' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Enviar comprovativo' }),
  ).toBeEnabled();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(storedRequest?.status).toBe('pending');
});

test.each([
  { status: 'payment_submitted' },
  { paymentStatus: 'proof_submitted' },
  { paymentProof: { url: 'https://example.com/proof.pdf' } },
  { paymentProof: { submittedAt: '2026-10-22T20:00:00Z' } },
  { status: 'approved' },
  { status: 'cancelled' },
  { status: 'rejected' },
  { paymentStatus: 'paid' },
  { paymentMethod: 'stripe' },
])(
  'não pede outro pagamento para um pedido já tratado ou online: %j',
  async (state) => {
    storedRequest = { ...pendingRequest, ...state };
    await openPlans();
    expect(screen.queryByText(/Pagamento pendente/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Concluir pagamento' }),
    ).not.toBeInTheDocument();
  },
);

test('pedidos antigos sem método guardado continuam a permitir enviar o comprovativo', async () => {
  storedRequest = {
    id: 'legacy',
    status: 'pending',
    planName: 'Verificação',
    price: 20,
  };
  await openPlans();
  expect(
    await screen.findByRole('button', { name: 'Concluir pagamento' }),
  ).toBeVisible();
});

test('retoma um pagamento online no respetivo plano, sem aviso manual nem pedido duplicado', async () => {
  storedRequest = {
    ...pendingRequest,
    planId: 'professional_candidato',
    planName: 'Profissional de teste',
    paymentMethod: 'stripe',
  };
  await openPlans();
  expect(screen.queryByText(/Pagamento pendente/)).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Continuar pagamento' }),
  );
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalledWith(
    '/api/subscribe-plan',
    expect.anything(),
  );
});
