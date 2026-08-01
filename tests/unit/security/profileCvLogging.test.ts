import { inspect } from 'node:util';

import { admin } from '../../../lib/firebaseAdmin';
import profileCvHandler from '../../../pages/api/profile/upload-cv';

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

describe('logs da rota de upload de CV', () => {
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

  test('não regista dados do candidato ou do CV numa falha inesperada', async () => {
    const canary =
      'candidato@example.test|cv-token|data:application/pdf;base64';
    const sensitiveError = Object.assign(new Error(canary), {
      code: 'auth/internal-error',
      customData: { cvName: canary, cvUrl: canary },
      serverResponse: { email: canary },
    });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(sensitiveError),
    });

    const response = createResponse();
    await profileCvHandler(
      {
        body: { cvName: canary, cvUrl: canary },
        headers: { authorization: 'Bearer token-de-teste' },
        method: 'POST',
      },
      response,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith('profile.cv_upload_failed', {
      category: 'authentication',
    });
    expect(inspect(consoleErrorSpy.mock.calls, { depth: null })).not.toContain(
      canary,
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Erro interno ao atualizar o CV.',
    });
  });
});
