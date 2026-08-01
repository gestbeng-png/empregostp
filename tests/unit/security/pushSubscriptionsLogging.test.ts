import { inspect } from 'node:util';

import { admin } from '../../../lib/firebaseAdmin';
import pushSubscriptionsHandler from '../../../pages/api/push-subscriptions';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
  },
}));

const authMock = admin.auth as unknown as jest.Mock;

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
      code: 'auth/internal-error',
      config: {
        data: { token: canary },
        headers: { authorization: `Bearer ${canary}` },
      },
    });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(sensitiveError),
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
      { category: 'authentication' },
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
