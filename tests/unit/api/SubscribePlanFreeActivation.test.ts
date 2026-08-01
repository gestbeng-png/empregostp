import { admin } from '../../../lib/firebaseAdmin';
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

function createResponse() {
  const response = {
    json: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function installFirestore(userType: string) {
  const userRef = {
    get: jest.fn().mockResolvedValue({
      data: () => ({
        currentPlan: 'basic_empresa',
        email: 'empresa@example.test',
        name: 'Empresa Teste',
        userType,
      }),
      exists: true,
    }),
    id: 'company-1',
  };
  const subscriptionRef = { id: 'subscription-1' };
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
    throw new Error(`Colecao inesperada: ${name}`);
  });

  firestoreMock.mockReturnValue({ collection, runTransaction });

  return { transaction, userRef };
}

describe('ativacao imediata de plano empresarial gratuito', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'company-1' }),
    });
  });

  test.each(['empresa', 'company'])(
    'ativa o plano e persiste os limites para o tipo %s',
    async (userType) => {
      const { transaction, userRef } = installFirestore(userType);
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
        message: 'Plano ativado com sucesso',
        status: 'approved',
      });
      expect(transaction.update).toHaveBeenCalledWith(
        userRef,
        expect.objectContaining({
          currentPlan: 'basic_empresa',
          destaque: false,
          planTierId: 'basic_empresa',
          vagasLimit: 1,
        }),
      );
    },
  );
});
