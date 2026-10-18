import { admin } from '../../../lib/firebaseAdmin';
import handler from '../../../pages/api/talent-pool';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const request = {
  method: 'GET',
  headers: { authorization: 'Bearer test-token' },
  query: {},
};
function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('autorização de conta no banco de talentos', () => {
  beforeEach(() => jest.clearAllMocks());

  test('verifica revogação e impede token revogado antes de ler candidatos', async () => {
    const verifyIdToken = jest.fn().mockRejectedValue(new Error('revoked'));
    authMock.mockReturnValue({ verifyIdToken });
    const res = response();
    await handler(request, res);
    expect(verifyIdToken).toHaveBeenCalledWith('test-token', true);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(firestoreMock).not.toHaveBeenCalled();
  });

  test('empresa suspensa não consulta os perfis, mesmo com plano pago', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'org-test' }),
    });
    const get = jest
      .fn()
      .mockResolvedValue({
        exists: true,
        data: () => ({
          userType: 'empresa',
          status: 'suspended',
          currentPlan: 'premium_empresa',
        }),
      });
    const collection = jest
      .fn()
      .mockReturnValue({ doc: jest.fn().mockReturnValue({ get }) });
    firestoreMock.mockReturnValue({ collection });
    const res = response();
    await handler(request, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Esta conta está suspensa ou inativa. Contacte o suporte para recuperar o acesso.',
      code: 'ACCOUNT_BLOCKED',
    });
    expect(collection.mock.calls).toEqual([['users']]);
  });

  test('candidato ativo continua sem acesso à pesquisa empresarial', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-test' }),
    });
    const get = jest
      .fn()
      .mockResolvedValue({
        exists: true,
        data: () => ({ userType: 'candidato', status: 'active' }),
      });
    const collection = jest
      .fn()
      .mockReturnValue({ doc: jest.fn().mockReturnValue({ get }) });
    firestoreMock.mockReturnValue({ collection });
    const res = response();
    await handler(request, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(collection.mock.calls).toEqual([['users']]);
  });
});
