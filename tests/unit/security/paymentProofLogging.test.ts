import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspect } from 'node:util';

import { admin } from '../../../lib/firebaseAdmin';
import paymentProofHandler from '../../../pages/api/subscription-requests/[id]/payment-proof';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
  },
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

describe('logs da rota de comprovativos de pagamento', () => {
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

  test('não regista nem devolve detalhes de um erro inesperado', async () => {
    const canary = 'candidato@example.test|token-super-secreto';
    const sensitiveError = new Error(`Falha privada: ${canary}`);
    Object.assign(sensitiveError, {
      code: 'auth/internal-error',
      paymentProof: `data:application/pdf;base64,${canary}`,
    });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(sensitiveError),
    });

    const response = createResponse();
    await paymentProofHandler(
      {
        body: {},
        headers: { authorization: 'Bearer token-de-teste' },
        method: 'POST',
        query: { id: 'request-1' },
      },
      response,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'payment_proof.request_failed',
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

  test('não mantém chamadas de console com erros crus na rota', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'pages/api/subscription-requests/[id]/payment-proof.js',
      ),
      'utf8',
    );

    expect(source).not.toMatch(/console\.(?:error|warn)\([^)]*,\s*\w*Error\b/);
  });
});
