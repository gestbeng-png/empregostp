import { admin } from '../../../lib/firebaseAdmin';
import messagesHandler from '../../../pages/api/messages/[conversationId]';
import messagesIndexHandler from '../../../pages/api/messages/index';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      increment: jest.fn((value: number) => ({ increment: value })),
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
  });

  return {
    admin: {
      auth: jest.fn(),
      firestore,
    },
  };
});

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

describe('envio atómico de mensagens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('grava a mensagem e atualiza o resumo da conversa no mesmo batch', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });

    const messageRef = { id: 'message-1' };
    const messagesCollection = {
      doc: jest.fn().mockReturnValue(messageRef),
    };
    const conversationRef = {
      collection: jest.fn().mockReturnValue(messagesCollection),
      get: jest.fn().mockResolvedValue({
        data: () => ({
          participants: ['candidate-1', 'company-1'],
        }),
        exists: true,
      }),
    };
    const usersCollection = {
      doc: jest.fn((uid: string) => ({
        get: jest.fn().mockResolvedValue({
          data: () => ({
            userType: uid === 'candidate-1' ? 'candidato' : 'empresa',
          }),
          exists: true,
        }),
      })),
    };
    const conversationsCollection = {
      doc: jest.fn().mockReturnValue(conversationRef),
    };
    const collection = jest.fn((name: string) => {
      if (name === 'users') return usersCollection;
      if (name === 'conversations') return conversationsCollection;
      throw new Error(`Coleção inesperada: ${name}`);
    });
    const set = jest.fn();
    const update = jest.fn();
    const commit = jest.fn().mockResolvedValue(undefined);
    const batch = jest.fn().mockReturnValue({ commit, set, update });

    firestoreMock.mockReturnValue({ batch, collection });

    const response = createResponse();
    await messagesHandler(
      {
        body: { text: '  Olá, podemos conversar?  ' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'POST',
        query: { conversationId: 'conversation-1' },
      },
      response,
    );

    expect(batch).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(messageRef, {
      createdAt: 'server-timestamp',
      senderId: 'candidate-1',
      text: 'Olá, podemos conversar?',
    });
    expect(update).toHaveBeenCalledWith(conversationRef, {
      lastMessage: 'Olá, podemos conversar?',
      updatedAt: 'server-timestamp',
      'unreadCounts.company-1': { increment: 1 },
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ messageId: 'message-1' });
  });
});

describe('privacidade ao criar ou retomar conversas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('permite retomar uma conversa existente sem reabrir a verificação de privacidade', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });

    const usersCollection = {
      doc: jest.fn((uid: string) => ({
        get: jest.fn().mockResolvedValue({
          data: () => ({
            userType: uid === 'candidate-1' ? 'candidato' : 'empresa',
          }),
          exists: true,
        }),
      })),
    };
    const existingConversation = {
      data: () => ({ participants: ['candidate-1', 'company-1'] }),
      id: 'existing-conversation',
    };
    const conversationsCollection = {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [existingConversation] }),
      }),
    };
    const collection = jest.fn((name: string) => {
      if (name === 'users') return usersCollection;
      if (name === 'conversations') return conversationsCollection;
      throw new Error(`Coleção inesperada: ${name}`);
    });

    firestoreMock.mockReturnValue({ collection });

    const response = createResponse();
    await messagesIndexHandler(
      {
        body: { participantId: 'company-1' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'POST',
      },
      response,
    );

    expect(collection).not.toHaveBeenCalledWith('profiles');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      conversationId: 'existing-conversation',
    });
  });

  test('bloqueia uma conversa nova iniciada por candidato com perfil privado', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });

    const usersCollection = {
      doc: jest.fn((uid: string) => ({
        get: jest.fn().mockResolvedValue({
          data: () => ({
            userType: uid === 'candidate-1' ? 'candidato' : 'empresa',
          }),
          exists: true,
        }),
      })),
    };
    const profilesCollection = {
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => ({
            settings: { privacy: { profileVisibility: 'private' } },
          }),
          exists: true,
        }),
      }),
    };
    const conversationsCollection = {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      }),
    };
    const collection = jest.fn((name: string) => {
      if (name === 'users') return usersCollection;
      if (name === 'profiles') return profilesCollection;
      if (name === 'conversations') return conversationsCollection;
      throw new Error(`Coleção inesperada: ${name}`);
    });
    const runTransaction = jest.fn();

    firestoreMock.mockReturnValue({ collection, runTransaction });

    const response = createResponse();
    await messagesIndexHandler(
      {
        body: { participantId: 'company-1' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'POST',
      },
      response,
    );

    expect(runTransaction).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Este candidato não está disponível para novas conversas.',
    });
  });

  test('não cria uma conversa nova que a empresa não poderá responder', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });

    const usersCollection = {
      doc: jest.fn((uid: string) => ({
        get: jest.fn().mockResolvedValue({
          data: () =>
            uid === 'candidate-1'
              ? { userType: 'candidato' }
              : { planId: 'basic_empresa', userType: 'empresa' },
          exists: true,
        }),
      })),
    };
    const profilesCollection = {
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => ({
            settings: { privacy: { profileVisibility: 'recruiters' } },
          }),
          exists: true,
        }),
      }),
    };
    const conversationsCollection = {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      }),
    };
    const collection = jest.fn((name: string) => {
      if (name === 'users') return usersCollection;
      if (name === 'profiles') return profilesCollection;
      if (name === 'conversations') return conversationsCollection;
      throw new Error(`Coleção inesperada: ${name}`);
    });
    const runTransaction = jest.fn();

    firestoreMock.mockReturnValue({ collection, runTransaction });

    const response = createResponse();
    await messagesIndexHandler(
      {
        body: { participantId: 'company-1' },
        headers: { authorization: 'Bearer valid-token' },
        method: 'POST',
      },
      response,
    );

    expect(runTransaction).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error:
          'Esta empresa ainda não tem as mensagens diretas ativas. Candidate-se a uma vaga para estabelecer contacto.',
      }),
    );
  });
});
