import { admin } from '../../../lib/firebaseAdmin';
import checkJobExpiration from '../../../pages/api/cron/check-job-expiration';
import checkPlanExpiration from '../../../pages/api/cron/check-plan-expiration';
import messagesHandler from '../../../pages/api/messages/[conversationId]';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      increment: jest.fn((value: number) => value),
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
    Timestamp: {
      now: jest.fn(() => 'firestore-now'),
    },
  });

  return {
    admin: {
      auth: jest.fn(),
      firestore,
    },
  };
});

jest.mock('../../../lib/defaultPlans', () => ({
  getDefaultBasicPlanForUserType: jest.fn(),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn(),
}));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;

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

describe('endpoints de expiração executados pelo Vercel Cron', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
  });

  afterAll(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  test('aceita GET autenticado para verificar planos expirados', async () => {
    const get = jest.fn().mockResolvedValue({ docs: [] });
    const secondWhere = jest.fn().mockReturnValue({ get });
    const firstWhere = jest.fn().mockReturnValue({ where: secondWhere });
    const collection = jest.fn().mockReturnValue({ where: firstWhere });
    const commit = jest.fn();

    firestoreMock.mockReturnValue({
      batch: jest.fn().mockReturnValue({ commit }),
      collection,
    });

    const response = createResponse();
    await checkPlanExpiration(
      {
        headers: { authorization: 'Bearer cron-secret' },
        method: 'GET',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
    expect(collection).toHaveBeenCalledWith('scheduledTasks');
    expect(commit).not.toHaveBeenCalled();
  });

  test('aceita GET autenticado para verificar vagas expiradas', async () => {
    const get = jest.fn().mockResolvedValue({ docs: [], size: 0 });
    const where = jest.fn().mockReturnValue({ get });
    const collection = jest.fn().mockReturnValue({ where });

    firestoreMock.mockReturnValue({ collection });

    const response = createResponse();
    await checkJobExpiration(
      {
        headers: { authorization: 'Bearer cron-secret' },
        method: 'GET',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
    expect(collection).toHaveBeenCalledWith('jobs');
  });

  test('GET continua protegido pelo segredo do cron', async () => {
    const response = createResponse();

    await checkJobExpiration(
      {
        headers: {},
        method: 'GET',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(firestoreMock).not.toHaveBeenCalled();
  });

  test('rejeita outros métodos e anuncia os métodos suportados', async () => {
    const response = createResponse();

    await checkPlanExpiration(
      {
        headers: { authorization: 'Bearer cron-secret' },
        method: 'PUT',
      },
      response,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Allow', ['GET', 'POST']);
    expect(response.status).toHaveBeenCalledWith(405);
    expect(firestoreMock).not.toHaveBeenCalled();
  });
});

describe('histórico de mensagens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('consulta as 100 mensagens mais recentes e responde em ordem cronológica', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'user-1' });
    authMock.mockReturnValue({ verifyIdToken });

    const oldestReturnedDate = new Date('2026-07-27T10:00:00.000Z');
    const newestReturnedDate = new Date('2026-07-27T11:00:00.000Z');
    const messagesDocs = [
      {
        data: () => ({
          createdAt: { toDate: () => newestReturnedDate },
          senderId: 'user-2',
          text: 'Mensagem mais recente',
        }),
        id: 'message-3',
      },
      {
        data: () => ({
          createdAt: { toDate: () => oldestReturnedDate },
          senderId: 'user-1',
          text: 'Mensagem anterior',
        }),
        id: 'message-2',
      },
    ];

    const getMessages = jest.fn().mockResolvedValue({ docs: messagesDocs });
    const limit = jest.fn().mockReturnValue({ get: getMessages });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const updateConversation = jest.fn().mockResolvedValue(undefined);
    const conversationRef = {
      collection: jest.fn().mockReturnValue({ orderBy }),
      get: jest.fn().mockResolvedValue({
        data: () => ({ participants: ['user-1', 'user-2'] }),
        exists: true,
      }),
      update: updateConversation,
    };
    const usersCollection = {
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => ({ userType: 'candidato' }),
          exists: true,
        }),
      }),
    };
    const conversationsCollection = {
      doc: jest.fn().mockReturnValue(conversationRef),
    };
    const collection = jest.fn((name: string) => {
      if (name === 'users') return usersCollection;
      if (name === 'conversations') return conversationsCollection;
      throw new Error(`Coleção inesperada: ${name}`);
    });

    firestoreMock.mockReturnValue({ collection });

    const response = createResponse();
    await messagesHandler(
      {
        headers: { authorization: 'Bearer valid-token' },
        method: 'GET',
        query: { conversationId: 'conversation-1' },
      },
      response,
    );

    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(100);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      messages: [
        expect.objectContaining({
          createdAt: oldestReturnedDate.toISOString(),
          id: 'message-2',
        }),
        expect.objectContaining({
          createdAt: newestReturnedDate.toISOString(),
          id: 'message-3',
        }),
      ],
    });
    expect(updateConversation).toHaveBeenCalledWith({
      'unreadCounts.user-1': 0,
    });
  });
});
