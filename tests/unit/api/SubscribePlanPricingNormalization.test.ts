import { admin } from '../../../lib/firebaseAdmin';
import { logServerWarning } from '../../../lib/serverLog';
import subscribePlanHandler from '../../../pages/api/subscribe-plan';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = jest.fn();

  class Timestamp {
    seconds: number;
    nanoseconds: number;

    constructor(seconds: number, nanoseconds: number) {
      if (!Number.isFinite(seconds)) {
        throw new Error('Timestamp seconds inválidos');
      }
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
const mockedWarning = jest.mocked(logServerWarning);

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
  currentPlan = 'basic_candidato',
  planDoc = null,
  userType = 'candidato',
}: {
  currentPlan?: string;
  planDoc?: Record<string, unknown> | null;
  userType?: string;
}) {
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
  const scheduledTaskRefs: Array<{ id: string }> = [];
  const transaction = {
    set: jest.fn(),
    update: jest.fn(),
  };
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
        doc: jest.fn(() => subscriptionRef),
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
      };
    }
    if (name === 'plans') {
      return {
        doc: jest.fn((planId: string) => ({
          get: jest.fn().mockResolvedValue(
            planDoc
              ? {
                  data: () => planDoc,
                  exists: true,
                  id: planId,
                }
              : { exists: false },
          ),
        })),
      };
    }
    if (name === 'notifications') {
      return { doc: jest.fn(() => notificationRef) };
    }
    if (name === 'subscriptions') {
      return { doc: jest.fn(() => subscriptionMirrorRef) };
    }
    if (name === 'scheduledTasks') {
      return {
        doc: jest.fn((taskId: string) => {
          const taskRef = { id: taskId };
          scheduledTaskRefs.push(taskRef);
          return taskRef;
        }),
      };
    }
    if (name === 'settings') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
        })),
      };
    }
    throw new Error(`Colecao inesperada: ${name}`);
  });

  firestoreMock.mockReturnValue({ collection, runTransaction });

  return {
    notificationRef,
    runTransaction,
    scheduledTaskRefs,
    subscriptionMirrorRef,
    subscriptionRef,
    transaction,
    userRef,
  };
}

async function postSubscription(planId: string) {
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

describe('normalizacao de preco e duracao no subscribe-plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
    });
  });

  test.each([
    { label: 'preco nao numerico', planDoc: { duration: 30, name: 'Profissional', price: 'abc', type: 'candidato' } },
    { label: 'preco negativo', planDoc: { duration: 30, name: 'Profissional', price: -50, type: 'candidato' } },
    { label: 'preco ausente', planDoc: { duration: 30, name: 'Profissional', type: 'candidato' } },
    { label: 'duracao nao numerica', planDoc: { duration: 'abc', name: 'Profissional', price: 150, type: 'candidato' } },
    { label: 'duracao nao positiva', planDoc: { duration: -3, name: 'Profissional', price: 150, type: 'candidato' } },
  ])(
    'rejeita configuracao invalida ($label) sem qualquer escrita',
    async ({ planDoc }) => {
      const { runTransaction, transaction } = installFirestore({ planDoc });

      const response = await postSubscription('professional_candidato');

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        message:
          'A configuração deste plano está inválida. Contacte o suporte.',
      });
      expect(mockedWarning).toHaveBeenCalledWith(
        'subscription.plan_config_invalid',
        undefined,
      );
      expect(runTransaction).not.toHaveBeenCalled();
      expect(transaction.set).not.toHaveBeenCalled();
      expect(transaction.update).not.toHaveBeenCalled();
    },
  );

  test('preco "0" em string ativa o plano imediatamente com lifecycle completo', async () => {
    const {
      scheduledTaskRefs,
      subscriptionMirrorRef,
      subscriptionRef,
      transaction,
      userRef,
    } = installFirestore({
      planDoc: {
        duration: '45',
        name: 'Profissional',
        price: '0',
        type: 'candidato',
      },
    });

    const response = await postSubscription('professional_candidato');

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Plano ativado com sucesso',
      status: 'approved',
    });

    const expectedEndSeconds = 1_700_000_000 + 45 * 24 * 60 * 60;
    const expectedVersion = 'subscription-request:subscription-1';

    const userUpdate = transaction.update.mock.calls.find(
      ([ref]) => ref === userRef,
    )?.[1];
    expect(userUpdate).toEqual(
      expect.objectContaining({
        currentPlan: 'professional_candidato',
        planActivationVersion: expectedVersion,
      }),
    );
    expect(userUpdate.planEndDate.seconds).toBe(expectedEndSeconds);

    const requestPayload = transaction.set.mock.calls.find(
      ([ref]) => ref === subscriptionRef,
    )?.[1];
    expect(requestPayload).toEqual(
      expect.objectContaining({
        autoApproved: true,
        duration: 45,
        paymentStatus: 'not_required',
        price: 0,
        status: 'approved',
      }),
    );

    const mirrorPayload = transaction.set.mock.calls.find(
      ([ref]) => ref === subscriptionMirrorRef,
    )?.[1];
    expect(mirrorPayload).toEqual(
      expect.objectContaining({
        activationVersion: expectedVersion,
        status: 'active',
      }),
    );
    expect(mirrorPayload.endDate.seconds).toBe(expectedEndSeconds);

    expect(scheduledTaskRefs).toHaveLength(1);
    const taskRef = scheduledTaskRefs[0];
    expect(taskRef?.id).toBe('plan-expiration_user-1_subscription-1');
    const taskPayload = transaction.set.mock.calls.find(
      ([ref]) => ref === taskRef,
    )?.[1];
    expect(taskPayload).toEqual(
      expect.objectContaining({
        activationVersion: expectedVersion,
        planId: 'professional_candidato',
        planTierId: 'professional_candidato',
        requestId: 'subscription-1',
        type: 'REVERT_TO_BASIC_PLAN',
        userId: 'user-1',
      }),
    );
    expect(taskPayload.executeAt.seconds).toBe(expectedEndSeconds);
    expect(taskPayload.planEndDate.seconds).toBe(expectedEndSeconds);
  });

  test('a ativacao do Basico continua sem tarefa agendada nem versao', async () => {
    const { scheduledTaskRefs, transaction, userRef } = installFirestore({
      currentPlan: 'professional_empresa',
      planDoc: null,
      userType: 'empresa',
    });

    const response = await postSubscription('basic_empresa');

    expect(response.status).toHaveBeenCalledWith(200);
    const userUpdate = transaction.update.mock.calls.find(
      ([ref]) => ref === userRef,
    )?.[1];
    expect(userUpdate).toEqual(
      expect.objectContaining({
        planActivationVersion: null,
        planEndDate: null,
      }),
    );
    expect(scheduledTaskRefs).toHaveLength(0);
  });

  test('preco "150" em string segue o caminho pago com valores numericos', async () => {
    const { subscriptionRef, transaction } = installFirestore({
      planDoc: {
        duration: '60',
        name: 'Profissional',
        price: '150',
        type: 'candidato',
      },
    });

    const response = await postSubscription('professional_candidato');

    expect(response.status).toHaveBeenCalledWith(200);
    const responsePayload = response.json.mock.calls[0][0];
    expect(responsePayload.status).toBe('awaiting_payment');
    expect(responsePayload.paymentInstructions.amount).toBe(150);

    const requestPayload = transaction.set.mock.calls.find(
      ([ref]) => ref === subscriptionRef,
    )?.[1];
    expect(requestPayload).toEqual(
      expect.objectContaining({
        duration: 60,
        paymentStatus: 'awaiting_proof',
        price: 150,
        status: 'pending',
      }),
    );
    expect(requestPayload.autoApproved).toBeUndefined();
  });

  test('plano pago sem duracao usa 30 dias em todos os campos', async () => {
    const { subscriptionRef, transaction } = installFirestore({
      planDoc: {
        name: 'Profissional',
        price: 500,
        type: 'candidato',
      },
    });

    const response = await postSubscription('professional_candidato');

    expect(response.status).toHaveBeenCalledWith(200);
    const requestPayload = transaction.set.mock.calls.find(
      ([ref]) => ref === subscriptionRef,
    )?.[1];
    expect(requestPayload).toEqual(
      expect.objectContaining({
        duration: 30,
        price: 500,
        status: 'pending',
      }),
    );
  });
});
