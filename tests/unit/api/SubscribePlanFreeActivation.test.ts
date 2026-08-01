import { admin } from '../../../lib/firebaseAdmin';
import { sendPushToUser } from '../../../lib/serverNotifications';
import subscribePlanHandler from '../../../pages/api/subscribe-plan';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = jest.fn();

  class Timestamp {
    seconds: number;
    nanoseconds: number;

    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    static now() {
      return new Timestamp(1_700_000_000, 123_000_000);
    }
  }

  Object.assign(firestore, { Timestamp });

  return {
    admin: {
      auth: jest.fn(),
      firestore,
    },
  };
});

jest.mock('../../../lib/rateLimit', () => ({
  rateLimitMiddleware: jest.fn((_req, _res, next) => next()),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  sendPushToUser: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const sendPushMock = jest.mocked(sendPushToUser);

function createResponse() {
  const response = {
    json: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function installFirestore(
  userType: string,
  currentPlan = 'professional_empresa',
) {
  const userRef = {
    get: jest.fn().mockResolvedValue({
      data: () => ({
        currentPlan,
        email: 'user@example.test',
        name: 'Utilizador Teste',
        planEndDate: currentPlan.startsWith('basic_') ? null : new Date(0),
        userType,
      }),
      exists: true,
    }),
    id: 'user-1',
  };
  const subscriptionRef = { id: 'subscription-1' };
  const subscriptionMirrorRef = { id: 'user-1' };
  const notificationRef = { id: 'notification-1' };
  const transaction = {
    set: jest.fn(),
    update: jest.fn(),
  };
  const runTransaction = jest.fn(async (callback) => callback(transaction));
  const collection = jest.fn((name: string) => {
    if (name === 'users') {
      return { doc: jest.fn(() => userRef) };
    }
    if (name === 'subscription-requests') {
      return {
        doc: jest.fn(() => subscriptionRef),
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
      };
    }
    if (name === 'plans') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
        })),
      };
    }
    if (name === 'notifications') {
      return { doc: jest.fn(() => notificationRef) };
    }
    if (name === 'subscriptions') {
      return { doc: jest.fn(() => subscriptionMirrorRef) };
    }
    throw new Error(`Colecao inesperada: ${name}`);
  });

  firestoreMock.mockReturnValue({ collection, runTransaction });

  return {
    notificationRef,
    runTransaction,
    subscriptionMirrorRef,
    subscriptionRef,
    transaction,
    userRef,
  };
}

describe('ativacao imediata de plano gratuito', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
    });
  });

  test.each([
    {
      currentPlan: 'professional_empresa',
      expectedEntitlements: { destaque: false, vagasLimit: 1 },
      expectedSubscriptionEntitlements: { destaque: false, vagasLimit: 1 },
      planId: 'basic_empresa',
      userType: 'empresa',
    },
    {
      currentPlan: 'professional_empresa',
      expectedEntitlements: { destaque: false, vagasLimit: 1 },
      expectedSubscriptionEntitlements: { destaque: false, vagasLimit: 1 },
      planId: 'basic_empresa',
      userType: 'company',
    },
    {
      currentPlan: 'professional_candidato',
      expectedEntitlements: {
        curriculoDestacado: false,
        destaque: false,
      },
      expectedSubscriptionEntitlements: { curriculoDestacado: false },
      planId: 'basic_candidato',
      userType: 'candidato',
    },
  ])(
    'ativa $planId e persiste o contrato para $userType',
    async ({
      currentPlan,
      expectedEntitlements,
      expectedSubscriptionEntitlements,
      planId,
      userType,
    }) => {
      const {
        notificationRef,
        subscriptionMirrorRef,
        subscriptionRef,
        transaction,
        userRef,
      } = installFirestore(userType, currentPlan);
      const response = createResponse();

      await subscribePlanHandler(
        {
          body: { planId },
          headers: { authorization: 'Bearer valid-token' },
          method: 'POST',
        },
        response,
      );

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Plano ativado com sucesso',
        status: 'approved',
      });
      expect(transaction.update).toHaveBeenCalledWith(
        userRef,
        expect.objectContaining({
          ...expectedEntitlements,
          currentPlan: planId,
          planActivationVersion: null,
          planEndDate: null,
          planId,
          planTierId: planId,
        }),
      );
      const requestPayload = transaction.set.mock.calls.find(
        ([ref]) => ref === subscriptionRef,
      )?.[1];
      expect(requestPayload).toEqual(
        expect.objectContaining({
          approvedDate: expect.anything(),
          autoApproved: true,
          paymentInstructions: null,
          paymentStatus: 'not_required',
          price: 0,
          processedAt: expect.anything(),
          status: 'approved',
        }),
      );
      expect(requestPayload.approvedDate).toBe(requestPayload.createdAt);
      expect(requestPayload.processedAt).toBe(requestPayload.createdAt);
      expect(requestPayload.requestDate).toBe(requestPayload.createdAt);
      expect(requestPayload.updatedAt).toBe(requestPayload.createdAt);

      expect(transaction.set).toHaveBeenCalledWith(
        subscriptionMirrorRef,
        expect.objectContaining({
          ...expectedSubscriptionEntitlements,
          activationVersion: null,
          endDate: null,
          planId,
          planTierId: planId,
          status: 'active',
          userId: 'user-1',
        }),
        { merge: true },
      );
      const userUpdate = transaction.update.mock.calls.find(
        ([ref]) => ref === userRef,
      )?.[1];
      const subscriptionPayload = transaction.set.mock.calls.find(
        ([ref]) => ref === subscriptionMirrorRef,
      )?.[1];
      const notificationPayload = transaction.set.mock.calls.find(
        ([ref]) => ref === notificationRef,
      )?.[1];
      expect(userUpdate.updatedAt).toBe(requestPayload.createdAt);
      expect(subscriptionPayload.startDate).toBe(requestPayload.createdAt);
      expect(notificationPayload.createdAt).toBe(requestPayload.createdAt);
      expect(sendPushMock).not.toHaveBeenCalled();
    },
  );

  test('nao cria novo pedido quando o plano basico ja esta ativo', async () => {
    const { runTransaction, transaction } = installFirestore(
      'empresa',
      'basic_empresa',
    );
    const response = createResponse();

    await subscribePlanHandler(
      {
        body: { planId: 'basic_empresa' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Plano já está ativo',
      status: 'approved',
    });
    expect(runTransaction).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
