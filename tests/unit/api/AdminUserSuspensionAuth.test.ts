import { admin } from '../../../lib/firebaseAdmin';
import adminUserHandler from '../../../pages/api/admin/users/[id]';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

const ALVO = 'utilizador-alvo';

function install({
  adminCount = 3,
  targetType = 'candidato',
}: { adminCount?: number; targetType?: string } = {}) {
  const updateUser = jest.fn().mockResolvedValue(undefined);
  const revokeRefreshTokens = jest.fn().mockResolvedValue(undefined);
  const update = jest.fn().mockResolvedValue(undefined);

  authMock.mockReturnValue({
    revokeRefreshTokens,
    updateUser,
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
  });

  const collection = jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn((uid: string) => ({
          get: jest.fn().mockResolvedValue(
            uid === 'admin-1'
              ? { data: () => ({ userType: 'admin' }), exists: true }
              : {
                  data: () => ({ email: 'alvo@example.test', name: 'Alvo', userType: targetType }),
                  exists: true,
                },
          ),
          update,
        })),
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: Array.from({ length: adminCount }, (_, i) => ({ id: `admin-${i + 1}` })),
            size: adminCount,
          }),
        })),
      };
    }
    if (name === 'activities') return { add: jest.fn().mockResolvedValue({ id: 'a-1' }) };
    throw new Error(`Colecao inesperada: ${name}`);
  });

  firestoreMock.mockReturnValue({ collection });
  return { revokeRefreshTokens, update, updateUser };
}

async function put(body: Record<string, unknown>, id = ALVO) {
  const response = createResponse();
  await adminUserHandler(
    {
      body,
      headers: { authorization: 'Bearer valido' },
      method: 'PUT',
      query: { id },
    } as never,
    response as never,
  );
  return response;
}

describe('suspender uma conta encerra também o acesso no Firebase Auth', () => {
  beforeEach(() => jest.clearAllMocks());

  test('suspender desativa no Auth e revoga os tokens em curso', async () => {
    const { revokeRefreshTokens, updateUser } = install();

    const response = await put({
      name: 'Alvo',
      status: 'suspended',
      userType: 'candidato',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(updateUser).toHaveBeenCalledWith(ALVO, { disabled: true });
    expect(revokeRefreshTokens).toHaveBeenCalledWith(ALVO);
  });

  test('reactivar volta a permitir o acesso no Auth', async () => {
    const { revokeRefreshTokens, updateUser } = install();

    await put({ name: 'Alvo', status: 'active', userType: 'candidato' });

    expect(updateUser).toHaveBeenCalledWith(ALVO, { disabled: false });
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  test('DELETE (desativação) também encerra o acesso', async () => {
    const { revokeRefreshTokens, updateUser } = install();
    const response = createResponse();

    await adminUserHandler(
      {
        body: {},
        headers: { authorization: 'Bearer valido' },
        method: 'DELETE',
        query: { id: ALVO },
      } as never,
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(updateUser).toHaveBeenCalledWith(ALVO, { disabled: true });
    expect(revokeRefreshTokens).toHaveBeenCalledWith(ALVO);
  });

  test('o último admin não pode ser despromovido nem suspenso', async () => {
    const { update } = install({ adminCount: 1, targetType: 'admin' });

    const despromocao = await put(
      { name: 'Alvo', status: 'active', userType: 'candidato' },
      'admin-unico',
    );
    expect(despromocao.status).toHaveBeenCalledWith(409);

    const suspensao = await put(
      { name: 'Alvo', status: 'suspended', userType: 'admin' },
      'admin-unico',
    );
    expect(suspensao.status).toHaveBeenCalledWith(409);
    expect(update).not.toHaveBeenCalled();
  });

  test('um admin não se pode suspender a si próprio', async () => {
    const { update } = install({ adminCount: 3, targetType: 'admin' });

    const response = await put(
      { name: 'Eu', status: 'suspended', userType: 'admin' },
      'admin-1',
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(update).not.toHaveBeenCalled();
  });
});
