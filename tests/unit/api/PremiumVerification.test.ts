import { fetchVerifiedCandidates } from '../../../lib/publicCandidates';
import { approveSubscriptionRequest } from '../../../lib/subscriptionActivation';
import planStatusHandler from '../../../pages/api/candidate/plan-status';
import profileHandler from '../../../pages/api/profile';
import talentPoolHandler from '../../../pages/api/talent-pool';
import { createFakeFirestore } from '../../helpers/fakeFirestore';

const fake = { current: createFakeFirestore() };
const verifyIdToken = jest.fn();
jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: () => ({ verifyIdToken }),
    firestore: Object.assign(() => fake.current.db, {
      Timestamp: {
        now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }),
        fromMillis: (ms: number) => ({
          toMillis: () => ms,
          toDate: () => new Date(ms),
        }),
      },
    }),
  },
}));
jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn(),
}));
jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function read(handler: typeof profileHandler) {
  const res = response();
  await handler(
    { method: 'GET', query: {}, headers: { authorization: 'Bearer test' } },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(200);
  return res.json.mock.calls[0][0];
}

describe('Premium confirmado → verificação efetiva nas APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyIdToken.mockResolvedValue({ uid: 'candidate-1' });
    fake.current = createFakeFirestore({
      'users/candidate-1': {
        userType: 'candidato',
        currentPlan: 'basic_candidato',
        verificationStatus: 'pending',
        verified: false,
        verificationItems: { identity: { status: 'pending' } },
      },
      'profiles/candidate-1': {},
      'verifications/old-request': { uid: 'candidate-1', status: 'pending' },
      'subscription-requests/premium-request': {
        userId: 'candidate-1',
        planType: 'candidato',
        status: 'payment_submitted',
        planId: 'configured-premium',
        planTierId: 'unlimited_candidato',
        planName: 'Premium',
        price: 200,
        duration: 30,
        paymentProof: { url: 'https://example.com/proof.pdf' },
      },
    });
  });

  test('comprovativo ainda em análise não concede selo', async () => {
    expect((await read(profileHandler)).profile.data).toMatchObject({
      verified: false,
      premiumVerified: false,
      verificationStatus: 'pending',
    });
    expect((await read(planStatusHandler)).visibility).toMatchObject({
      verified: false,
      premiumVerified: false,
    });
  });

  test('aprovar o pagamento ativa imediatamente o selo sem aprovar documentos', async () => {
    await approveSubscriptionRequest({
      requestId: 'premium-request',
      processedBy: 'admin-1',
    });
    expect((await read(profileHandler)).profile.data).toMatchObject({
      currentPlan: 'unlimited_candidato',
      verified: true,
      paidVerified: true,
      premiumVerified: true,
      qualifiedVerified: false,
      verificationStatus: 'verified',
      verificationReviewStatus: 'pending',
      verificationItems: { identity: { status: 'pending' } },
    });
    expect((await read(planStatusHandler)).visibility).toMatchObject({
      verified: true,
      paidVerified: true,
      premiumVerified: true,
      verificationTypes: ['paid'],
    });
    expect(fake.current.docs.get('verifications/old-request')?.status).toBe(
      'pending',
    );
    // Sem flags falsas permanentes nem aprovação documental na ativação.
    expect(fake.current.docs.get('users/candidate-1')?.verified).toBe(false);
    expect(verifyIdToken).toHaveBeenCalledWith('test', true);
  });

  test('Premium existente sem flags recebe o selo em leitura, sem migração ou escritas', async () => {
    fake.current.docs.set('users/candidate-1', {
      userType: 'candidato',
      currentPlan: 'unlimited_candidato',
      planEndDate: { seconds: new Date('2099-01-01').getTime() / 1000 },
      verified: false,
      verificationStatus: 'rejected',
    });
    const before = new Map(fake.current.docs);
    expect((await read(profileHandler)).profile.data).toMatchObject({
      verified: true,
      premiumVerified: true,
      verificationStatus: 'verified',
      verificationReviewStatus: 'rejected',
    });
    expect((await read(planStatusHandler)).visibility.premiumVerified).toBe(
      true,
    );
    expect(fake.current.docs).toEqual(before);
  });

  test('Premium expirado perde o selo automático sem aguardar o cron', async () => {
    fake.current.docs.set('users/candidate-1', {
      userType: 'candidato',
      currentPlan: 'unlimited_candidato',
      planEndDate: '2020-01-01T00:00:00Z',
    });
    expect((await read(profileHandler)).profile.data).toMatchObject({
      verified: false,
      premiumVerified: false,
      verificationStatus: 'unverified',
    });
    expect((await read(planStatusHandler)).visibility.verified).toBe(false);
  });

  test('Premium sem flags aparece nas listagens mesmo fora da primeira página de candidatos', async () => {
    // Mais de 200 registos básicos antes do Premium: a consulta ampla não chega a ele.
    fake.current = createFakeFirestore(
      Object.fromEntries(
        Array.from({ length: 205 }, (_, index) => [
          `users/basic-${index}`,
          { userType: 'candidato', currentPlan: 'basic_candidato' },
        ]),
      ),
    );
    fake.current.docs.set('users/premium-last', {
      userType: 'candidato',
      currentPlan: 'unlimited_candidato',
      verified: false,
      verificationStatus: 'pending',
    });
    const listed = await fetchVerifiedCandidates(
      { firestore: () => fake.current.db },
      { maxFetch: 1 },
    );
    expect(listed.map((candidate) => candidate?.id)).toEqual(['premium-last']);
    fake.current.docs.set('users/company-1', {
      userType: 'empresa',
      currentPlan: 'unlimited_empresa',
    });
    verifyIdToken.mockResolvedValue({ uid: 'company-1' });
    expect((await read(talentPoolHandler)).candidates).toEqual([
      expect.objectContaining({
        id: 'premium-last',
        verified: true,
        paidVerified: true,
        qualifiedVerified: false,
      }),
    ]);
  });

  test('suspensão explícita pelo admin não é contornada pelo Premium', async () => {
    fake.current.docs.set('users/candidate-1', {
      userType: 'candidato',
      currentPlan: 'unlimited_candidato',
      verificationStatus: 'verified',
      verified: true,
      verificationDisabled: true,
    });
    expect((await read(profileHandler)).profile.data).toMatchObject({
      verified: false,
      paidVerified: false,
      premiumVerified: false,
      verificationStatus: 'revoked',
    });
  });
});
