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

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn().mockResolvedValue(true),
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

function installFirestore({
  currentPlan,
  planEndDate,
}: {
  currentPlan: string;
  planEndDate: Date | null;
}) {
  const userRef = {
    get: jest.fn().mockResolvedValue({
      data: () => ({
        currentPlan,
        email: 'user@example.test',
        name: 'Utilizador Teste',
        planEndDate,
        userType: 'candidato',
      }),
      exists: true,
    }),
    id: 'user-1',
  };
  const notificationRef = { id: 'notification-1' };
  const transaction = { set: jest.fn(), update: jest.fn() };
  const runTransaction = jest.fn(async (callback) => callback(transaction));
  const collection = jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => userRef),
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
      };
    }
    if (name === 'subscription-requests') {
      return {
        doc: jest.fn(() => ({ id: 'subscription-1' })),
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
    if (name === 'settings') {
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
  return { runTransaction, transaction, userRef };
}

async function postSubscription(planId: string) {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
  });
  const response = createResponse();
  await subscribePlanHandler(
    {
      body: { planId },
      headers: { authorization: 'Bearer valid-token' },
      method: 'POST',
    },
    response,
  );
  return response;
}

describe('verificação de perfil coexiste com um plano pago ativo', () => {
  beforeEach(() => jest.clearAllMocks());

  test('candidato Premium consegue "ativar" verificação sem perder o plano', async () => {
    const { runTransaction } = installFirestore({
      currentPlan: 'unlimited_candidato',
      planEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });

    const response = await postSubscription('verification_candidato');

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
    );
    // Nenhuma escrita: o plano Premium não é tocado nem rebaixado.
    expect(runTransaction).not.toHaveBeenCalled();
  });

  test('a resposta não usa o código de bloqueio de upgrade', async () => {
    installFirestore({
      currentPlan: 'unlimited_candidato',
      planEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });

    const response = await postSubscription('verification_candidato');

    const payload = response.json.mock.calls[0][0];
    expect(payload.code).not.toBe('UPGRADE_ONLY');
  });

  test('candidato Profissional (sem verificação incluída) continua bloqueado — sem regressão', async () => {
    installFirestore({
      currentPlan: 'professional_candidato',
      planEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });

    const response = await postSubscription('verification_candidato');

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UPGRADE_ONLY' }),
    );
  });

  test('candidato Básico continua a poder comprar a Verificação normalmente', async () => {
    const { runTransaction } = installFirestore({
      currentPlan: 'basic_candidato',
      planEndDate: null,
    });

    const response = await postSubscription('verification_candidato');

    expect(response.status).toHaveBeenCalledWith(200);
    const payload = response.json.mock.calls[0][0];
    expect(payload.status).toBe('awaiting_payment');
    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  test('Premium a pedir Premium de novo continua a ser tratado como plano já ativo', async () => {
    installFirestore({
      currentPlan: 'unlimited_candidato',
      planEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });

    const response = await postSubscription('unlimited_candidato');

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PLAN_ALREADY_ACTIVE' }),
    );
  });
});
