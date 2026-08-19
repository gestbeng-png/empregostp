import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { admin } from '../../../lib/firebaseAdmin';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = {
    end: jest.fn(),
    json: jest.fn(),
    status: jest.fn(),
  };
  response.end.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function mockUser(data: Record<string, unknown>, exists = true) {
  const userRef = {
    get: jest.fn().mockResolvedValue({ data: () => data, exists }),
  };
  firestoreMock.mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue(userRef),
    }),
  });
  return userRef;
}

describe('requireActiveApiUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
  });

  test('verifica revogação, carrega o utilizador e devolve o mesmo snapshot', async () => {
    const userRef = mockUser({ status: 'active', userType: 'candidato' });
    const response = createResponse();

    const result = await requireActiveApiUser(
      { headers: { authorization: 'Bearer id-token' } },
      response,
    );

    expect(authMock().verifyIdToken).toHaveBeenCalledWith('id-token', true);
    expect(userRef.get).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        uid: 'candidate-1',
        userData: { status: 'active', userType: 'candidato' },
        userRef,
      }),
    );
    expect(response.status).not.toHaveBeenCalled();
  });

  test.each(['inactive', 'suspended', 'disabled'])(
    'rejeita conta %s antes da lógica da rota',
    async (status) => {
      mockUser({ status, userType: 'candidato' });
      const response = createResponse();

      const result = await requireActiveApiUser(
        { headers: { authorization: 'Bearer id-token' } },
        response,
      );

      expect(result).toBeNull();
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        code: 'ACCOUNT_BLOCKED',
        error: 'Esta conta está suspensa ou inativa.',
      });
    },
  );

  test('trata token revogado como sessão inválida', async () => {
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue({ code: 'auth/id-token-revoked' }),
    });
    const response = createResponse();

    const result = await requireActiveApiUser(
      { headers: { authorization: 'Bearer revoked-token' } },
      response,
    );

    expect(result).toBeNull();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(firestoreMock).not.toHaveBeenCalled();
  });
});
