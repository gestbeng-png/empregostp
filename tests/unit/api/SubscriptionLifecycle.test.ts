import { admin } from '../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../lib/serverNotifications';
import {
  assertPaymentProofHashAvailable,
  assertPaymentProofUploadEligible,
  buildPlanActivationVersion,
  buildPlanExpirationTaskId,
  evaluatePlanExpirationTask,
} from '../../../lib/subscriptionLifecycle';
import checkPlanExpiration from '../../../pages/api/cron/check-plan-expiration';
import paymentProofHandler from '../../../pages/api/subscription-requests/[id]/payment-proof';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
    Timestamp: {
      now: jest.fn(() => new Date('2026-07-28T12:00:00.000Z')),
    },
  });

  return {
    admin: {
      app: jest.fn(),
      auth: jest.fn(),
      firestore,
      storage: jest.fn(),
    },
  };
});

jest.mock('../../../lib/defaultPlans', () => ({
  getDefaultBasicPlanForUserType: jest.fn(),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn(),
  sendPushToUser: jest.fn(),
}));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;
const appMock = admin.app as unknown as jest.Mock;
const storageMock = admin.storage as unknown as jest.Mock;
const createServerNotificationMock = createServerNotification as jest.Mock;

function createResponse() {
  const response = {
    json: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

describe('regras do ciclo de vida da subscrição', () => {
  const expiredAt = new Date('2026-07-28T11:00:00.000Z');
  const now = new Date('2026-07-28T12:00:00.000Z');

  test('aceita comprovativo apenas enquanto o pedido está pendente de processamento', () => {
    expect(() => assertPaymentProofUploadEligible({
      price: 100,
      status: 'pending',
      userId: 'candidate-1',
    }, 'candidate-1')).not.toThrow();

    expect(() => assertPaymentProofUploadEligible({
      price: 100,
      status: 'payment_submitted',
      userId: 'candidate-1',
    }, 'candidate-1')).not.toThrow();

    expect(() => assertPaymentProofUploadEligible({
      price: 100,
      status: 'approved',
      userId: 'candidate-1',
    }, 'candidate-1')).toThrow('Este pedido já foi processado');
  });

  test('gera versão e tarefa determinísticas a partir do pedido aprovado', () => {
    expect(buildPlanActivationVersion('request-42'))
      .toBe('subscription-request:request-42');
    expect(buildPlanExpirationTaskId('user-1', 'request-42'))
      .toBe('plan-expiration_user-1_request-42');
  });

  test('considera elegível apenas a ativação expirada que ainda é a atual', () => {
    const result = evaluatePlanExpirationTask({
      now,
      task: {
        activationVersion: 'subscription-request:request-42',
        executeAt: expiredAt,
        planEndDate: expiredAt,
        planId: 'professional-plan',
      },
      user: {
        currentPlan: 'professional_empresa',
        planActivationVersion: 'subscription-request:request-42',
        planEndDate: expiredAt,
        planId: 'professional-plan',
      },
      subscription: {
        activationVersion: 'subscription-request:request-42',
        endDate: expiredAt,
        planId: 'professional-plan',
        status: 'active',
      },
    });

    expect(result).toEqual({
      eligible: true,
      reason: 'current_expired_activation',
    });
  });

  test('rejeita tarefa antiga quando uma ativação mais recente já está ativa', () => {
    const result = evaluatePlanExpirationTask({
      now,
      task: {
        activationVersion: 'subscription-request:old-request',
        executeAt: expiredAt,
        planEndDate: expiredAt,
        planId: 'professional-plan',
      },
      user: {
        currentPlan: 'unlimited_empresa',
        planActivationVersion: 'subscription-request:new-request',
        planEndDate: new Date('2026-08-28T11:00:00.000Z'),
        planId: 'unlimited-plan',
      },
      subscription: {
        activationVersion: 'subscription-request:new-request',
        endDate: new Date('2026-08-28T11:00:00.000Z'),
        planId: 'unlimited-plan',
        status: 'active',
      },
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('user_expiration_changed');
  });

  test('uma tarefa legada não pode expirar uma subscrição do fluxo versionado', () => {
    const result = evaluatePlanExpirationTask({
      now,
      task: {
        executeAt: expiredAt,
      },
      user: {
        currentPlan: 'professional_candidato',
        planActivationVersion: 'subscription-request:new-request',
        planEndDate: expiredAt,
      },
      subscription: {
        activationVersion: 'subscription-request:new-request',
        endDate: expiredAt,
        status: 'active',
      },
    });

    expect(result).toEqual({
      eligible: false,
      reason: 'legacy_task_for_versioned_plan',
    });
  });
});

describe('escritas concorrentes no ciclo de vida da subscrição', () => {
  const originalCronSecret = process.env.CRON_SECRET;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  test('revalida o pedido em transação e remove upload órfão se o admin já o processou', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
    appMock.mockReturnValue({
      options: {
        projectId: 'test-project',
        storageBucket: 'test-project.firebasestorage.app',
      },
    });

    const save = jest.fn().mockResolvedValue(undefined);
    const deleteUploadedFile = jest.fn().mockResolvedValue(undefined);
    const file = jest.fn().mockReturnValue({
      delete: deleteUploadedFile,
      save,
    });
    const bucket = jest.fn().mockReturnValue({
      file,
      name: 'test-project.firebasestorage.app',
    });
    storageMock.mockReturnValue({ bucket });

    const requestRef = {
      get: jest.fn().mockResolvedValue({
        data: () => ({
          planId: 'professional-plan',
          price: 100,
          status: 'pending',
          userId: 'candidate-1',
        }),
        exists: true,
        id: 'request-1',
      }),
    };
    const transactionUpdate = jest.fn();
    const runTransaction = jest.fn(async (callback) => callback({
      get: jest.fn().mockResolvedValue({
        data: () => ({
          planId: 'professional-plan',
          price: 100,
          status: 'approved',
          userId: 'candidate-1',
        }),
        exists: true,
      }),
      update: transactionUpdate,
    }));
    const collection = jest.fn((name: string) => {
      if (name === 'subscription-requests') {
        return { doc: jest.fn().mockReturnValue(requestRef) };
      }
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({
      collection,
      runTransaction,
    });

    const response = createResponse();
    await paymentProofHandler(
      {
        body: {
          contentType: 'application/pdf',
          fileBase64: 'data:application/pdf;base64,JVBERi0xLjQ=',
          proofName: 'comprovativo.pdf',
        },
        headers: { authorization: 'Bearer valid-token' },
        method: 'POST',
        query: { id: 'request-1' },
      },
      response,
    );

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(transactionUpdate).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(deleteUploadedFile).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(response.status).toHaveBeenCalledWith(409);
  });

  test('o cron apaga a tarefa antiga sem alterar um plano mais recente', async () => {
    const expiredAt = new Date('2026-07-28T11:00:00.000Z');
    const newerEndDate = new Date('2026-08-28T11:00:00.000Z');
    const taskRef = { id: 'old-task' };
    const userRef = { id: 'company-1' };
    const subscriptionRef = { id: 'company-1' };
    const taskQueryGet = jest.fn().mockResolvedValue({
      docs: [{ id: 'old-task', ref: taskRef }],
    });
    const secondWhere = jest.fn().mockReturnValue({ get: taskQueryGet });
    const firstWhere = jest.fn().mockReturnValue({ where: secondWhere });
    const transactionDelete = jest.fn();
    const transactionUpdate = jest.fn();
    const transactionSet = jest.fn();
    const transactionGet = jest.fn(async (ref) => {
      if (ref === taskRef) {
        return {
          data: () => ({
            activationVersion: 'subscription-request:old-request',
            executeAt: expiredAt,
            planEndDate: expiredAt,
            planId: 'professional-plan',
            userId: 'company-1',
          }),
          exists: true,
        };
      }
      if (ref === userRef) {
        return {
          data: () => ({
            currentPlan: 'unlimited_empresa',
            planActivationVersion: 'subscription-request:new-request',
            planEndDate: newerEndDate,
            planId: 'unlimited-plan',
            userType: 'empresa',
          }),
          exists: true,
        };
      }
      if (ref === subscriptionRef) {
        return {
          data: () => ({
            activationVersion: 'subscription-request:new-request',
            endDate: newerEndDate,
            planId: 'unlimited-plan',
            status: 'active',
          }),
          exists: true,
        };
      }
      throw new Error('Referência inesperada');
    });
    const runTransaction = jest.fn(async (callback) => callback({
      delete: transactionDelete,
      get: transactionGet,
      set: transactionSet,
      update: transactionUpdate,
    }));
    const collection = jest.fn((name: string) => {
      if (name === 'scheduledTasks') return { where: firstWhere };
      if (name === 'users') {
        return { doc: jest.fn().mockReturnValue(userRef) };
      }
      if (name === 'subscriptions') {
        return { doc: jest.fn().mockReturnValue(subscriptionRef) };
      }
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({
      collection,
      runTransaction,
    });

    const response = createResponse();
    await checkPlanExpiration(
      {
        headers: { authorization: 'Bearer cron-secret' },
        method: 'GET',
      },
      response,
    );

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(transactionDelete).toHaveBeenCalledWith(taskRef);
    expect(transactionUpdate).not.toHaveBeenCalled();
    expect(transactionSet).not.toHaveBeenCalled();
    expect(createServerNotificationMock).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      stats: {
        errors: 0,
        processed: 1,
        skipped: 1,
        updated: 0,
      },
      success: true,
    }));
  });

  test('o cron mantém o downgrade normal quando tarefa, utilizador e subscrição coincidem', async () => {
    const expiredAt = new Date('2026-07-28T11:00:00.000Z');
    const activationVersion = 'subscription-request:request-1';
    const taskRef = { id: 'current-task' };
    const userRef = { id: 'candidate-1' };
    const subscriptionRef = { id: 'candidate-1' };
    const basicPlanRef = { id: 'basic_candidato' };
    const taskQueryGet = jest.fn().mockResolvedValue({
      docs: [{ id: 'current-task', ref: taskRef }],
    });
    const secondWhere = jest.fn().mockReturnValue({ get: taskQueryGet });
    const firstWhere = jest.fn().mockReturnValue({ where: secondWhere });
    const transactionDelete = jest.fn();
    const transactionUpdate = jest.fn();
    const transactionSet = jest.fn();
    const transactionGet = jest.fn(async (ref) => {
      if (ref === taskRef) {
        return {
          data: () => ({
            activationVersion,
            executeAt: expiredAt,
            planEndDate: expiredAt,
            planId: 'professional-plan',
            userId: 'candidate-1',
          }),
          exists: true,
        };
      }
      if (ref === userRef) {
        return {
          data: () => ({
            currentPlan: 'professional_candidato',
            planActivationVersion: activationVersion,
            planEndDate: expiredAt,
            planId: 'professional-plan',
            userType: 'candidato',
          }),
          exists: true,
        };
      }
      if (ref === subscriptionRef) {
        return {
          data: () => ({
            activationVersion,
            endDate: expiredAt,
            planId: 'professional-plan',
            status: 'active',
          }),
          exists: true,
        };
      }
      if (ref === basicPlanRef) {
        return {
          data: () => ({
            curriculoDestacado: false,
            features: ['perfil'],
            name: 'Básico',
          }),
          exists: true,
        };
      }
      throw new Error('Referência inesperada');
    });
    const runTransaction = jest.fn(async (callback) => callback({
      delete: transactionDelete,
      get: transactionGet,
      set: transactionSet,
      update: transactionUpdate,
    }));
    const collection = jest.fn((name: string) => {
      if (name === 'scheduledTasks') return { where: firstWhere };
      if (name === 'users') {
        return { doc: jest.fn().mockReturnValue(userRef) };
      }
      if (name === 'subscriptions') {
        return { doc: jest.fn().mockReturnValue(subscriptionRef) };
      }
      if (name === 'plans') {
        return { doc: jest.fn().mockReturnValue(basicPlanRef) };
      }
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({
      collection,
      runTransaction,
    });

    const response = createResponse();
    await checkPlanExpiration(
      {
        headers: { authorization: 'Bearer cron-secret' },
        method: 'GET',
      },
      response,
    );

    expect(transactionUpdate).toHaveBeenCalledWith(userRef, expect.objectContaining({
      currentPlan: 'basic_candidato',
      planActivationVersion: null,
      planEndDate: null,
    }));
    expect(transactionSet).toHaveBeenCalledWith(subscriptionRef, expect.objectContaining({
      activationVersion: null,
      planId: 'basic_candidato',
      status: 'active',
    }));
    expect(transactionDelete).toHaveBeenCalledWith(taskRef);
    expect(createServerNotificationMock).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        type: 'plan_expired',
        userId: 'candidate-1',
      }),
    );
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      stats: {
        errors: 0,
        processed: 1,
        skipped: 0,
        updated: 1,
      },
      success: true,
    }));
  });
});

describe('assertPaymentProofHashAvailable', () => {
  test('aceita um hash novo ou já ligado ao mesmo pedido', () => {
    expect(() =>
      assertPaymentProofHashAvailable(null, null, 'request-1'),
    ).not.toThrow();
    expect(() =>
      assertPaymentProofHashAvailable(
        { requestId: 'request-1' },
        null,
        'request-1',
      ),
    ).not.toThrow();
  });

  test.each(['pending', 'payment_submitted', 'approved'])(
    'recusa o hash de outro pedido em estado %s',
    (status) => {
      expect(() =>
        assertPaymentProofHashAvailable(
          { requestId: 'request-0' },
          { status },
          'request-1',
        ),
      ).toThrow(
        expect.objectContaining({ code: 'PAYMENT_PROOF_DUPLICATE' }),
      );
    },
  );

  test('liberta o hash de um pedido rejeitado ou que já não existe', () => {
    expect(() =>
      assertPaymentProofHashAvailable(
        { requestId: 'request-0' },
        { status: 'rejected' },
        'request-1',
      ),
    ).not.toThrow();
    expect(() =>
      assertPaymentProofHashAvailable(
        { requestId: 'request-0' },
        null,
        'request-1',
      ),
    ).not.toThrow();
  });
});
