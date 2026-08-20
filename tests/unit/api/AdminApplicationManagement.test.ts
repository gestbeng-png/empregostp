import { admin } from '../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../lib/serverNotifications';
import applicationStatusHandler from '../../../pages/api/applications/[id]/status';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
}));

jest.mock('firebase-admin', () => ({
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
  },
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue(undefined),
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

function configureFirestore(
  jobData: Record<string, unknown>,
  options: {
    application?: Record<string, unknown>;
    userData?: Record<string, unknown>;
  } = {},
) {
  const applicationData = {
    candidateId: 'candidate-1',
    companyId: '',
    jobId: 'job-1',
    jobTitle: 'Gestor de Projetos',
    status: 'pending',
    timeline: [],
    ...(options.application || {}),
  };
  const applicationRef = {
    get: jest.fn().mockResolvedValue({
      data: () => applicationData,
      exists: true,
    }),
  };
  const activityAdd = jest.fn().mockResolvedValue(undefined);
  const transactionUpdate = jest.fn();
  const transaction = {
    get: jest.fn().mockResolvedValue({
      data: () => applicationData,
      exists: true,
    }),
    update: transactionUpdate,
  };
  const runTransaction = jest.fn(async (callback) => callback(transaction));
  const collection = jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () =>
              options.userData || { name: 'Administrador', userType: 'admin' },
            exists: true,
          }),
        })),
      };
    }
    if (name === 'applications') {
      return { doc: jest.fn(() => applicationRef) };
    }
    if (name === 'jobs') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => jobData,
            exists: true,
          }),
        })),
      };
    }
    if (name === 'activities') return { add: activityAdd };
    throw new Error(`Coleção inesperada: ${name}`);
  });
  firestoreMock.mockReturnValue({ collection, runTransaction });

  return { activityAdd, runTransaction, transactionUpdate };
}

describe('gestão administrativa das candidaturas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
  });

  test('permite atualizar uma candidatura de vaga publicada pelo Admin', async () => {
    const { activityAdd, transactionUpdate } = configureFirestore({
      companyName: 'Empresa Parceira STP',
      createdByRole: 'admin',
    });
    const response = createResponse();

    await applicationStatusHandler(
      {
        body: { status: 'analysis' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'PATCH',
        query: { id: 'application-1' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'analysis',
        timeline: expect.arrayContaining([
          expect.objectContaining({ byType: 'admin', companyName: 'Empresa Parceira STP' }),
        ]),
      }),
    );
    expect(notificationMock).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        newStatus: 'analysis',
        userId: 'candidate-1',
      }),
    );
    expect(activityAdd).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', actorType: 'admin' }),
    );
  });

  test('impede o Admin de alterar candidaturas de vagas publicadas por empresas', async () => {
    const { activityAdd, runTransaction } = configureFirestore({
      companyId: 'company-1',
      createdBy: 'company-1',
      createdByRole: 'empresa',
    });
    const response = createResponse();

    await applicationStatusHandler(
      {
        body: { status: 'approved' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'PATCH',
        query: { id: 'application-1' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(activityAdd).not.toHaveBeenCalled();
    expect(notificationMock).not.toHaveBeenCalled();
  });

  test('impede a empresa de reabrir uma candidatura retirada', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'company-1' }),
    });
    const { activityAdd, transactionUpdate } = configureFirestore(
      {
        companyId: 'company-1',
        createdBy: 'company-1',
        createdByRole: 'empresa',
      },
      {
        application: {
          candidateId: 'candidate-1',
          companyId: 'company-1',
          status: 'withdrawn',
        },
        userData: { name: 'Empresa STP', userType: 'empresa' },
      },
    );
    const response = createResponse();

    await applicationStatusHandler(
      {
        body: { status: 'approved' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'PATCH',
        query: { id: 'application-1' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'APPLICATION_WITHDRAWN' }),
    );
    expect(transactionUpdate).not.toHaveBeenCalled();
    expect(activityAdd).not.toHaveBeenCalled();
    expect(notificationMock).not.toHaveBeenCalled();
  });
});
