import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspect } from 'node:util';

import { admin } from '../../../lib/firebaseAdmin';
import subscribePlanHandler from '../../../pages/api/subscribe-plan';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
  },
}));

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  sendPushToUser: jest.fn(),
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

describe('logs da subscrição de planos', () => {
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

  test('não regista nem devolve dados internos do erro', async () => {
    const canary = 'empresa@example.test|bearer-secreto|conta-bancaria';
    const sensitiveError = Object.assign(new Error(canary), {
      code: 'auth/internal-error',
      config: {
        body: { paymentInstructions: canary },
        headers: { authorization: `Bearer ${canary}` },
      },
      serverResponse: canary,
    });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(sensitiveError),
    });

    const response = createResponse();
    await subscribePlanHandler(
      {
        body: { planId: 'professional_empresa' },
        headers: { authorization: 'Bearer token-de-teste' },
        method: 'POST',
      },
      response,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'subscription.request_failed',
      { category: 'authentication' },
    );
    expect(inspect(consoleErrorSpy.mock.calls, { depth: null })).not.toContain(
      canary,
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Erro ao processar solicitação de assinatura',
      message: 'Erro ao processar solicitação de assinatura',
    });
  });

  test('não mantém chamadas diretas de console na rota', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'pages/api/subscribe-plan.js'),
      'utf8',
    );

    expect(source).not.toMatch(/console\.(?:log|warn|error)/);
  });
});
