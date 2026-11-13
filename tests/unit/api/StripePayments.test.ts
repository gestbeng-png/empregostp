import { Readable } from 'node:stream';

import { buildCandidateVisibility } from '@/lib/candidateProfileInsights';
import { canChargeOnline, dobrasToEuroCents } from '@/lib/payments/currency';
import { fulfillCheckoutSession } from '@/lib/payments/stripe';
import checkoutHandler from '@/pages/api/payments/stripe/checkout';
import confirmHandler from '@/pages/api/payments/stripe/confirm';
import webhookHandler from '@/pages/api/payments/stripe/webhook';
import { createFakeFirestore } from '@/tests/helpers/fakeFirestore';

const fake = { current: createFakeFirestore() };
const verifyIdToken = jest.fn();
const stripeApi = {
  create: jest.fn(),
  retrieve: jest.fn(),
  expire: jest.fn(),
  constructEvent: jest.fn(),
};

jest.mock('@/lib/firebaseAdmin', () => {
  const firestore = Object.assign(() => fake.current.db, {
    Timestamp: {
      now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }),
      fromMillis: (ms: number) => ({
        ms,
        toMillis: () => ms,
        toDate: () => new Date(ms),
      }),
    },
  });
  return { admin: { auth: () => ({ verifyIdToken }), firestore } };
});
jest.mock('@/lib/serverNotifications', () => ({
  createServerNotification: jest.fn(async () => undefined),
}));
jest.mock('@/lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn(async () => true),
}));
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => stripeApi.create(...args),
        retrieve: (...args: unknown[]) => stripeApi.retrieve(...args),
        expire: (...args: unknown[]) => stripeApi.expire(...args),
      },
    },
    webhooks: {
      constructEvent: (...args: unknown[]) => stripeApi.constructEvent(...args),
    },
  })),
);

function response() {
  const res = {
    statusCode: 0,
    body: undefined as unknown as { url?: string } & Record<string, unknown>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: { url?: string } & Record<string, unknown>) {
      res.body = body;
      return res;
    },
    setHeader: jest.fn(),
  };
  return res;
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_1',
    payment_status: 'paid',
    amount_total: 204,
    currency: 'eur',
    payment_intent: 'pi_1',
    metadata: { requestId: 'r1', userId: 'u1' },
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- documentos do Firestore falso
const doc = (path: string) => fake.current.docs.get(path) as any;

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
  jest.clearAllMocks();
  verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@exemplo.st' });
  fake.current = createFakeFirestore({
    'users/u1': { userType: 'candidato', email: 'a@exemplo.st' },
    'subscription-requests/r1': {
      userId: 'u1',
      status: 'pending',
      price: 50,
      duration: 30,
      planId: 'professional_candidato',
      planTierId: 'professional_candidato',
      planName: 'Profissional',
      planType: 'candidato',
      stripeCheckout: { sessionId: 'cs_test_1', status: 'open' },
    },
  });
});

describe('câmbio Dobras → euros', () => {
  test('converte à paridade fixa de 24,5', () => {
    expect(dobrasToEuroCents(20)).toBe(82);
    expect(dobrasToEuroCents(50)).toBe(204);
    expect(dobrasToEuroCents(200)).toBe(816);
    expect(dobrasToEuroCents(0)).toBe(0);
  });

  test('abaixo do mínimo do Stripe não é cobrado online', () => {
    expect(canChargeOnline(12)).toBe(false);
    expect(canChargeOnline(20)).toBe(true);
  });
});

describe('fulfillCheckoutSession', () => {
  test('só Premium confirmado ativa o selo automaticamente, sem aprovar competências', async () => {
    doc('subscription-requests/r1').planTierId = 'unlimited_candidato';
    doc('subscription-requests/r1').planId = 'unlimited_candidato';
    doc('subscription-requests/r1').planName = 'Premium';
    doc('subscription-requests/r1').price = 200;
    doc('users/u1').verificationStatus = 'pending';
    doc('users/u1').verificationMethod = 'competencies';
    doc('users/u1').verificationItems = { competencies: { status: 'pending' } };
    await fulfillCheckoutSession(
      paidSession({ payment_status: 'unpaid', amount_total: 816 }),
    );
    expect(buildCandidateVisibility(doc('users/u1')).verified).toBe(false);
    await fulfillCheckoutSession(paidSession({ amount_total: 816 }));
    expect(doc('users/u1').currentPlan).toBe('unlimited_candidato');
    expect(buildCandidateVisibility(doc('users/u1'))).toMatchObject({
      verified: true,
      paidVerified: true,
      premiumVerified: true,
      qualifiedVerified: false,
    });
  });

  test('pagamento confirmado ativa o plano uma só vez', async () => {
    await expect(fulfillCheckoutSession(paidSession())).resolves.toEqual(
      expect.objectContaining({ status: 'approved' }),
    );
    expect(doc('subscription-requests/r1')).toEqual(
      expect.objectContaining({
        status: 'approved',
        processedBy: 'stripe',
        paymentMethod: 'stripe',
      }),
    );
    expect(doc('subscription-requests/r1').stripeCheckout.status).toBe('paid');
    expect(doc('users/u1').currentPlan).toBe('professional_candidato');

    // O webhook e o regresso ao site chegam os dois: o segundo não faz nada.
    await expect(fulfillCheckoutSession(paidSession())).resolves.toEqual(
      expect.objectContaining({ status: 'approved' }),
    );
    expect(
      [...fake.current.docs.keys()].some((key) =>
        key.startsWith('paymentIncidents/'),
      ),
    ).toBe(false);
  });

  test('pagamento ainda por confirmar não ativa nada', async () => {
    await expect(
      fulfillCheckoutSession(paidSession({ payment_status: 'unpaid' })),
    ).resolves.toEqual(expect.objectContaining({ status: 'processing' }));
    expect(doc('subscription-requests/r1').status).toBe('pending');
  });

  test.each([
    ['valor diferente', { amount_total: 100 }],
    ['outra moeda', { currency: 'usd' }],
    ['outro titular', { metadata: { requestId: 'r1', userId: 'u2' } }],
  ])('%s fica registado como incidente', async (_label, overrides) => {
    await expect(
      fulfillCheckoutSession(paidSession(overrides)),
    ).resolves.toEqual(expect.objectContaining({ status: 'incident' }));
    expect(doc('subscription-requests/r1').status).toBe('pending');
    expect(doc('paymentIncidents/stripe-cs_test_1')).toEqual(
      expect.objectContaining({ reason: 'amount_or_owner_mismatch' }),
    );
  });

  test('pedido cancelado e pago depois fica registado para reembolso', async () => {
    await fake.current.db
      .collection('subscription-requests')
      .doc('r1')
      .update({ status: 'cancelled' });
    await expect(fulfillCheckoutSession(paidSession())).resolves.toEqual(
      expect.objectContaining({ status: 'incident' }),
    );
    expect(doc('paymentIncidents/stripe-cs_test_1').reason).toBe(
      'request_cancelled',
    );
  });
});

describe('POST /api/payments/stripe/checkout', () => {
  async function call(body: Record<string, unknown>) {
    const res = response();
    await checkoutHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer t', host: 'localhost:3000' },
        body,
      } as never,
      res as never,
    );
    return res;
  }

  test('cria a sessão em euros e devolve o URL do Stripe', async () => {
    stripeApi.retrieve.mockResolvedValue({
      id: 'cs_test_1',
      status: 'expired',
    });
    stripeApi.create.mockResolvedValue({
      id: 'cs_test_2',
      url: 'https://checkout.stripe.com/c/pay/cs_test_2',
    });
    const res = await call({ requestId: 'r1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');
    const [params] = stripeApi.create.mock.calls[0];
    expect(params.line_items[0].price_data).toEqual(
      expect.objectContaining({ currency: 'eur', unit_amount: 204 }),
    );
    expect(params.metadata).toEqual({ requestId: 'r1', userId: 'u1' });
    expect(params.success_url).toContain(
      'http://localhost:3000/dashboard/candidato?tab=plans&pagamento=stripe',
    );
    expect(doc('subscription-requests/r1').stripeCheckout).toEqual(
      expect.objectContaining({ sessionId: 'cs_test_2', amountCents: 204 }),
    );
  });

  test('reaproveita a sessão ainda aberta', async () => {
    stripeApi.retrieve.mockResolvedValue({
      id: 'cs_test_1',
      status: 'open',
      amount_total: 204,
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
    const res = await call({ requestId: 'r1' });
    expect(res.body.url).toContain('cs_test_1');
    expect(stripeApi.create).not.toHaveBeenCalled();
  });

  test('recusa um pedido com comprovativo de transferência', async () => {
    await fake.current.db
      .collection('subscription-requests')
      .doc('r1')
      .update({ paymentProof: { url: 'https://x' } });
    const res = await call({ requestId: 'r1' });
    expect(res.statusCode).toBe(409);
    expect(stripeApi.create).not.toHaveBeenCalled();
  });

  test('o pedido de outra pessoa responde como inexistente', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u2' });
    fake.current.docs.set('users/u2', { userType: 'candidato' });
    const res = await call({ requestId: 'r1' });
    expect(res.statusCode).toBe(404);
  });

  test('sem chave do Stripe o pagamento online está desligado', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    jest.resetModules();
    const { default: handler } =
      await import('@/pages/api/payments/stripe/checkout');
    const res = response();
    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: { requestId: 'r1' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(503);
  });
});

describe('POST /api/payments/stripe/confirm', () => {
  test('não ativa a sessão de outra pessoa', async () => {
    stripeApi.retrieve.mockResolvedValue(
      paidSession({ metadata: { requestId: 'r1', userId: 'u2' } }),
    );
    const res = response();
    await confirmHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: { sessionId: 'cs_test_1' },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
    expect(doc('subscription-requests/r1').status).toBe('pending');
  });

  test('ativa a própria sessão paga', async () => {
    stripeApi.retrieve.mockResolvedValue(paidSession());
    const res = response();
    await confirmHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: { sessionId: 'cs_test_1' },
      } as never,
      res as never,
    );
    expect(res.body).toEqual({ status: 'approved', planName: 'Profissional' });
  });
});

describe('POST /api/payments/stripe/webhook', () => {
  function webhookRequest() {
    return Object.assign(Readable.from([Buffer.from('{"raw":true}')]), {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
    });
  }

  test('assinatura inválida é recusada', async () => {
    stripeApi.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = response();
    await webhookHandler(webhookRequest() as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(doc('subscription-requests/r1').status).toBe('pending');
  });

  test('checkout concluído ativa o plano com o corpo exato assinado', async () => {
    stripeApi.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: paidSession() },
    });
    const res = response();
    await webhookHandler(webhookRequest() as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(stripeApi.constructEvent.mock.calls[0][0].toString()).toBe(
      '{"raw":true}',
    );
    expect(doc('subscription-requests/r1').status).toBe('approved');
  });
});
