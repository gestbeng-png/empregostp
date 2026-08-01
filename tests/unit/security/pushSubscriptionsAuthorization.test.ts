import { admin } from '../../../lib/firebaseAdmin';
import pushSubscriptionsHandler from '../../../pages/api/push-subscriptions';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
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

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

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

function installFirestore(existingData?: Record<string, unknown>) {
  const snapshot = {
    data: () => existingData,
    exists: existingData !== undefined,
  };
  const transaction = {
    delete: jest.fn(),
    get: jest.fn().mockResolvedValue(snapshot),
    set: jest.fn(),
  };
  const runTransaction = jest.fn(async (callback) => callback(transaction));
  const docRef = {
    delete: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const doc = jest.fn().mockReturnValue(docRef);
  const collection = jest.fn().mockReturnValue({ doc });
  firestoreMock.mockReturnValue({ collection, runTransaction });

  return { docRef, runTransaction, transaction };
}

function createRequest(
  method: string,
  body: Record<string, unknown> = { token: 'fcm-token-1' },
) {
  return {
    body,
    headers: { authorization: 'Bearer token-de-teste' },
    method,
  };
}

describe('autorização da rota de subscrições push', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'owner-1' }),
    });
  });

  test('impede apagar uma subscrição pertencente a outro utilizador', async () => {
    const { docRef, transaction } = installFirestore({ userId: 'victim-1' });
    const response = createResponse();

    await pushSubscriptionsHandler(createRequest('DELETE'), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(transaction.delete).not.toHaveBeenCalled();
    expect(docRef.delete).not.toHaveBeenCalled();
  });

  test('remove em transação apenas a subscrição do proprietário', async () => {
    const { docRef, runTransaction, transaction } = installFirestore({
      userId: 'owner-1',
    });
    const response = createResponse();

    await pushSubscriptionsHandler(createRequest('DELETE'), response);

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.delete).toHaveBeenCalledTimes(1);
    expect(docRef.delete).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test('trata a remoção de uma subscrição inexistente como idempotente', async () => {
    const { transaction } = installFirestore();
    const response = createResponse();

    await pushSubscriptionsHandler(createRequest('DELETE'), response);

    expect(transaction.delete).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test('impede reatribuir no POST um token pertencente a outra conta', async () => {
    const { docRef, transaction } = installFirestore({ userId: 'victim-1' });
    const response = createResponse();

    await pushSubscriptionsHandler(createRequest('POST'), response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(docRef.set).not.toHaveBeenCalled();
  });

  test('regista um token novo sem expor o identificador do documento', async () => {
    const { docRef, transaction } = installFirestore();
    const response = createResponse();

    await pushSubscriptionsHandler(
      createRequest('POST', {
        permission: 'granted',
        token: 'fcm-token-1',
        userAgent: 'Browser de teste',
      }),
      response,
    );

    expect(transaction.set).toHaveBeenCalledWith(
      expect.any(Object),
      {
        createdAt: 'server-timestamp',
        enabled: true,
        permission: 'granted',
        platform: 'web',
        token: 'fcm-token-1',
        updatedAt: 'server-timestamp',
        userAgent: 'Browser de teste',
        userId: 'owner-1',
      },
      { merge: true },
    );
    expect(docRef.set).not.toHaveBeenCalled();
  });

  test('preserva createdAt quando o proprietário renova o mesmo token', async () => {
    const { transaction } = installFirestore({
      createdAt: 'data-original',
      userId: 'owner-1',
    });
    const response = createResponse();

    await pushSubscriptionsHandler(createRequest('POST'), response);

    const writtenData = transaction.set.mock.calls[0]?.[1];
    expect(writtenData).not.toHaveProperty('createdAt');
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test.each([
    [{ token: {} }, 'Token de push inválido'],
    [{ token: ' token-com-espacos ' }, 'Token de push inválido'],
    [{ token: 'token com espaços' }, 'Token de push inválido'],
    [{ token: 'x'.repeat(4097) }, 'Token de push inválido'],
    [
      { permission: 'admin', token: 'fcm-token-1' },
      'Permissão de push inválida',
    ],
    [
      { token: 'fcm-token-1', userAgent: 'x'.repeat(513) },
      'Navegador inválido',
    ],
  ])('rejeita corpo inválido sem tocar no Firestore', async (body, error) => {
    const { runTransaction } = installFirestore();
    const response = createResponse();

    await pushSubscriptionsHandler(createRequest('POST', body), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  test('devolve 401 para um bearer inválido sem o registar como erro interno', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('token expirado')),
    });
    const { runTransaction } = installFirestore();
    const response = createResponse();

    await pushSubscriptionsHandler(createRequest('POST'), response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Token inválido ou expirado',
    });
    expect(runTransaction).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test('declara os métodos permitidos antes da autenticação', async () => {
    const response = createResponse();

    await pushSubscriptionsHandler(
      { body: {}, headers: {}, method: 'PUT' },
      response,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Allow', ['POST', 'DELETE']);
    expect(response.status).toHaveBeenCalledWith(405);
    expect(authMock).not.toHaveBeenCalled();
  });
});
