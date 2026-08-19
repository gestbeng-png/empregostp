import { admin } from '../../../lib/firebaseAdmin';
import handler from '../../../pages/api/drafts/[scope]';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
    Timestamp: {
      fromMillis: jest.fn((value: number) => ({
        toDate: () => new Date(value),
      })),
    },
  });

  const mockedAdmin = { auth: jest.fn(), firestore };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
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

describe('API de rascunhos privados', () => {
  const set = jest.fn().mockResolvedValue(undefined);
  const remove = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
    const draftDoc = { delete: remove, get, set };
    const formDrafts = { doc: jest.fn(() => draftDoc) };
    // A rota chama `requireActiveApiUser` (lib/apiUserAuth.js), que faz
    // `userRef.get()` e valida o estado da conta. Sem estes dois membros a
    // rota rebentava e devolvia 500 — os testes passavam a "falhar" sem nunca
    // exercitar a lógica de rascunhos que dizem cobrir.
    const userDoc = {
      collection: jest.fn((name: string) => {
        if (name !== 'formDrafts') throw new Error('coleção inesperada');
        return formDrafts;
      }),
      get: jest.fn().mockResolvedValue({
        data: () => ({ status: 'active', userType: 'candidato' }),
        exists: true,
      }),
    };
    firestoreMock.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => userDoc) })),
    });
  });

  test('exige sessão e valida o scope antes de aceder ao Firestore', async () => {
    authMock.mockReturnValue({ verifyIdToken: jest.fn() });
    const response = createResponse();

    await handler(
      {
        body: {},
        headers: {},
        method: 'GET',
        query: { resourceId: 'default', scope: 'candidate-profile' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(firestoreMock).not.toHaveBeenCalled();
  });

  test('guarda somente conteúdo serializável e remove segredos', async () => {
    const response = createResponse();

    await handler(
      {
        body: {
          data: {
            bio: 'Perfil profissional',
            password: 'nunca guardar',
            nested: { access_token: 'segredo', city: 'São Tomé' },
          },
          version: 1,
        },
        headers: { authorization: 'Bearer valid-token' },
        method: 'PUT',
        query: { resourceId: 'default', scope: 'candidate-profile' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bio: 'Perfil profissional',
          nested: { city: 'São Tomé' },
        },
        ownerId: 'candidate-1',
        scope: 'candidate-profile',
      }),
      { merge: false },
    );
  });

  test('devolve o rascunho do próprio utilizador e permite apagá-lo', async () => {
    get.mockResolvedValueOnce({
      data: () => ({
        data: { title: 'Rascunho' },
        expiresAt: { toDate: () => new Date('2099-09-01T10:00:00.000Z') },
        updatedAt: { toDate: () => new Date('2026-08-15T10:00:00.000Z') },
        version: 1,
      }),
      exists: true,
    });
    const getResponse = createResponse();

    await handler(
      {
        headers: { authorization: 'Bearer valid-token' },
        method: 'GET',
        query: { resourceId: 'job-1', scope: 'company-job' },
      },
      getResponse,
    );

    expect(getResponse.status).toHaveBeenCalledWith(200);
    expect(getResponse.json).toHaveBeenCalledWith({
      draft: {
        data: { title: 'Rascunho' },
        expiresAt: '2099-09-01T10:00:00.000Z',
        savedAt: '2026-08-15T10:00:00.000Z',
        version: 1,
      },
    });

    const deleteResponse = createResponse();
    await handler(
      {
        headers: { authorization: 'Bearer valid-token' },
        method: 'DELETE',
        query: { resourceId: 'job-1', scope: 'company-job' },
      },
      deleteResponse,
    );

    expect(remove).toHaveBeenCalledTimes(1);
    expect(deleteResponse.status).toHaveBeenCalledWith(200);
  });
});
