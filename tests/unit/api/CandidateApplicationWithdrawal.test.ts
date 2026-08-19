import { admin } from '../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../lib/serverNotifications';
import withdrawHandler from '../../../pages/api/applications/[id]/withdraw';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const notificationMock = jest.mocked(createServerNotification);

function createResponse() {
  const response = {
    json: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.setHeader.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function configureFirestore({
  application = {},
  userType = 'candidato',
}: {
  application?: Record<string, unknown>;
  userType?: string;
} = {}) {
  const applicationData = {
    candidateId: 'candidate-1',
    candidateName: 'Pessoa Candidata',
    companyId: 'company-1',
    jobId: 'job-1',
    jobTitle: 'Gestor de Projetos',
    status: 'pending',
    timeline: [],
    ...application,
  };
  const applicationRef = { id: 'application-1' };
  const transactionUpdate = jest.fn();
  const transaction = {
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => applicationData,
    }),
    update: transactionUpdate,
  };
  const runTransaction = jest.fn(async (callback) => callback(transaction));
  const activityAdd = jest.fn().mockResolvedValue(undefined);

  firestoreMock.mockReturnValue({
    collection: jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ userType }),
            }),
          })),
        };
      }
      if (name === 'applications') {
        return { doc: jest.fn(() => applicationRef) };
      }
      if (name === 'admin_activities') return { add: activityAdd };
      throw new Error(`Coleção inesperada: ${name}`);
    }),
    runTransaction,
  });

  return { activityAdd, runTransaction, transactionUpdate };
}

function request() {
  return {
    body: {},
    headers: { authorization: 'Bearer valid-token' },
    method: 'POST',
    query: { id: 'application-1' },
  };
}

describe('retirada de candidatura pelo candidato', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
    // Passar por `unknown` em vez de intersectar com o tipo real: a interseção
    // obrigava o mock a satisfazer também a assinatura `() => FieldValue`.
    (
      admin.firestore as unknown as {
        FieldValue: { serverTimestamp: jest.Mock };
      }
    ).FieldValue = {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    };
  });

  test.each(['pending', 'analysis'])(
    'permite ao proprietário retirar no estado %s',
    async (status) => {
      const { transactionUpdate, activityAdd } = configureFirestore({
        application: { status },
      });
      const response = createResponse();

      await withdrawHandler(request(), response);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(transactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'withdrawn',
          timeline: expect.arrayContaining([
            expect.objectContaining({
              title: 'Candidatura retirada',
              byType: 'candidato',
            }),
          ]),
        }),
      );
      expect(activityAdd).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'withdraw_application' }),
      );
      expect(notificationMock).toHaveBeenCalledWith(
        admin,
        expect.objectContaining({ userId: 'company-1' }),
      );
    },
  );

  test('impede retirar a candidatura de outro candidato', async () => {
    const { transactionUpdate, activityAdd } = configureFirestore({
      application: { candidateId: 'candidate-2' },
    });
    const response = createResponse();

    await withdrawHandler(request(), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(transactionUpdate).not.toHaveBeenCalled();
    expect(activityAdd).not.toHaveBeenCalled();
    expect(notificationMock).not.toHaveBeenCalled();
  });

  test.each(['interview', 'approved', 'rejected'])(
    'recusa retirada depois de a candidatura chegar a %s',
    async (status) => {
      const { transactionUpdate } = configureFirestore({
        application: { status },
      });
      const response = createResponse();

      await withdrawHandler(request(), response);

      expect(response.status).toHaveBeenCalledWith(409);
      expect(transactionUpdate).not.toHaveBeenCalled();
      expect(notificationMock).not.toHaveBeenCalled();
    },
  );

  test('recusa utilizadores que não são candidatos', async () => {
    const { runTransaction } = configureFirestore({ userType: 'empresa' });
    const response = createResponse();

    await withdrawHandler(request(), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  test('é idempotente quando a candidatura já está retirada', async () => {
    const { transactionUpdate, activityAdd } = configureFirestore({
      application: { status: 'withdrawn' },
    });
    const response = createResponse();

    await withdrawHandler(request(), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ alreadyWithdrawn: true }),
    );
    expect(transactionUpdate).not.toHaveBeenCalled();
    expect(activityAdd).not.toHaveBeenCalled();
  });
});
