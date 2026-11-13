import nookies from 'nookies';

import { admin } from '../../../lib/firebaseAdmin';
import sessionHandler from '../../../pages/api/auth/session';

jest.mock('nookies', () => ({
  __esModule: true,
  default: {
    destroy: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

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

function mockAccount(data: Record<string, unknown>) {
  firestoreMock.mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => data,
          exists: true,
        }),
      }),
    }),
  });
}

describe('cookie de sessão servidor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({
        exp: Math.floor(Date.now() / 1000) + 1800,
        uid: 'candidate-1',
      }),
    });
  });

  test('cria cookie HttpOnly, SameSite=Lax e limitado à expiração do token', async () => {
    mockAccount({ status: 'active', userType: 'candidato' });
    const response = createResponse();

    await sessionHandler(
      {
        headers: { authorization: 'Bearer id-token' },
        method: 'POST',
      } as never,
      response as never,
    );

    expect(authMock().verifyIdToken).toHaveBeenCalledWith('id-token', true);
    expect(nookies.set).toHaveBeenCalledWith(
      expect.anything(),
      'token',
      'id-token',
      expect.objectContaining({
        httpOnly: true,
        maxAge: expect.any(Number),
        path: '/',
        sameSite: 'lax',
      }),
    );
    const options = (nookies.set as unknown as jest.Mock).mock.calls[0][3];
    expect(options.maxAge).toBeGreaterThan(0);
    expect(options.maxAge).toBeLessThanOrEqual(1800);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test.each(['inactive', 'suspended', 'disabled'])(
    'não cria sessão para conta %s',
    async (status) => {
      mockAccount({ status, userType: 'candidato' });
      const response = createResponse();

      await sessionHandler(
        {
          headers: { authorization: 'Bearer id-token' },
          method: 'POST',
        } as never,
        response as never,
      );

      expect(response.status).toHaveBeenCalledWith(403);
      expect(nookies.set).not.toHaveBeenCalled();
      expect(nookies.destroy).toHaveBeenCalledWith(
        expect.anything(),
        'token',
        expect.objectContaining({ httpOnly: true, path: '/', sameSite: 'lax' }),
      );
    },
  );

  test('DELETE expira o cookie no servidor', async () => {
    const response = createResponse();
    const request = { headers: {}, method: 'DELETE' };

    await sessionHandler(request as never, response as never);

    expect(nookies.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ req: request, res: response }),
      'token',
      expect.objectContaining({ httpOnly: true, path: '/', sameSite: 'lax' }),
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test('DELETE com Bearer termina esta sessão sem revogar outros dispositivos', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'candidate-1' });
    const revokeRefreshTokens = jest.fn().mockResolvedValue(undefined);
    authMock.mockReturnValue({ revokeRefreshTokens, verifyIdToken });
    const response = createResponse();

    await sessionHandler(
      {
        headers: { authorization: 'Bearer logout-token' },
        method: 'DELETE',
      } as never,
      response as never,
    );

    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
    expect(nookies.destroy).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ success: true });
  });

  test('Firebase indisponível não impede a expiração local do cookie', async () => {
    authMock.mockReturnValue({
      revokeRefreshTokens: jest.fn().mockRejectedValue(new Error('unavailable')),
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
    const response = createResponse();

    await sessionHandler(
      {
        headers: { authorization: 'Bearer logout-token' },
        method: 'DELETE',
      } as never,
      response as never,
    );

    expect(nookies.destroy).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ success: true });
    expect(authMock).not.toHaveBeenCalled();
  });
});
