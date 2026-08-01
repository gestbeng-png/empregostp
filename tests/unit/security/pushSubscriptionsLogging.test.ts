import { inspect } from 'node:util';

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
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

describe('logs da rota de subscrições push', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('não regista o token ou detalhes internos quando ocorre uma falha', async () => {
    const canary = 'fcm-token-super-secreto|candidato@example.test';
    const sensitiveError = Object.assign(new Error(canary), {
      code: 'firestore/internal-error',
      config: {
        data: { token: canary },
        headers: { authorization: `Bearer ${canary}` },
      },
    });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'owner-1' }),
    });
    firestoreMock.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ id: 'subscription-1' }),
      }),
      runTransaction: jest.fn().mockRejectedValue(sensitiveError),
    });

    const response = createResponse();
    await pushSubscriptionsHandler(
      {
        body: { token: canary },
        headers: { authorization: 'Bearer token-de-teste' },
        method: 'POST',
      },
      response,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'push_subscription.request_failed',
      { category: 'firestore' },
    );
    expect(inspect(consoleErrorSpy.mock.calls, { depth: null })).not.toContain(
      canary,
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Erro interno do servidor',
    });
  });
});
