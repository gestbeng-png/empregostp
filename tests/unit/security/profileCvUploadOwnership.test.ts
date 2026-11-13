import { admin } from '../../../lib/firebaseAdmin';
import handler from '../../../pages/api/profile/upload-cv';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
  });
  const mockedAdmin = { auth: jest.fn(), firestore };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

const update = jest.fn().mockResolvedValue(undefined);
const set = jest.fn().mockResolvedValue(undefined);

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

function installFirestore(user: Record<string, unknown> = {}) {
  const docRef = {
    get: jest.fn().mockResolvedValue({
      data: () => ({ cvName: 'cv.pdf', userType: 'candidato', ...user }),
      exists: true,
    }),
    set,
    update,
  };
  firestoreMock.mockReturnValue({
    collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })),
  });
}

async function post(body: Record<string, unknown>, { revoked = false } = {}) {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn(async (_token: string, checkRevoked?: boolean) => {
      if (revoked && checkRevoked)
        throw Object.assign(new Error('Revoked'), {
          code: 'auth/id-token-revoked',
        });
      return { uid: 'cand-1' };
    }),
  });
  const response = createResponse();
  await handler(
    { body, headers: { authorization: 'Bearer valid' }, method: 'POST' },
    response,
  );
  return response;
}

describe('posse do ficheiro no upload de CV', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installFirestore();
  });

  test('aceita um CV dentro do diretório do próprio candidato', async () => {
    const response = await post({
      cvName: 'cv.pdf',
      cvUrl:
        'https://firebasestorage.googleapis.com/v0/b/b/o/cvUrl%2Fcand-1%2F1700_cv.pdf?alt=media&token=t',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(update).toHaveBeenCalled();
  });

  test.each(['admin', 'empresa'])('a conta %s não atualiza CV através do fluxo de candidato', async (userType) => {
    installFirestore({ userType });
    const response = await post({ cvName: 'cv.pdf', cvUrl: 'cvUrl/cand-1/cv.pdf' });
    expect(response.status).toHaveBeenCalledWith(403);
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test('rejeita um URL que aponta para o CV de outro candidato', async () => {
    const response = await post({
      cvName: 'cv.pdf',
      cvUrl:
        'https://firebasestorage.googleapis.com/v0/b/b/o/cvUrl%2Fvitima%2F1700_cv.pdf?alt=media&token=t',
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test('rejeita um URL que aponta para comprovativos de pagamento', async () => {
    const response = await post({
      cvName: 'cv.pdf',
      cvUrl:
        'https://firebasestorage.googleapis.com/v0/b/b/o/payment-proofs%2Fvitima%2Fproof.pdf?alt=media&token=t',
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(update).not.toHaveBeenCalled();
  });

  test('rejeita um URL externo arbitrário', async () => {
    const response = await post({
      cvName: 'cv.pdf',
      cvUrl: 'https://atacante.example.com/payload.pdf',
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(update).not.toHaveBeenCalled();
  });

  test('persiste o caminho do objeto para a entrega por URL assinado', async () => {
    await post({
      cvName: 'cv.pdf',
      cvUrl:
        'https://firebasestorage.googleapis.com/v0/b/b/o/cvUrl%2Fcand-1%2F1700_cv.pdf?alt=media&token=t',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cvStoragePath: 'cvUrl/cand-1/1700_cv.pdf' }),
    );
  });

  test('a resposta não devolve o URL de longa duração do Storage', async () => {
    const response = await post({
      cvName: 'cv.pdf',
      cvUrl:
        'https://firebasestorage.googleapis.com/v0/b/b/o/cvUrl%2Fcand-1%2F1700_cv.pdf?alt=media&token=t',
    });

    const payload = JSON.stringify(response.json.mock.calls[0][0]);
    expect(payload).not.toContain('token=t');
  });

  test.each(['suspended', 'inactive', 'disabled', 'deleted'])(
    'não altera o CV de uma conta %s',
    async (status) => {
      installFirestore({ status });

      const response = await post({
        cvName: 'cv.pdf',
        cvUrl: 'cvUrl/cand-1/cv.pdf',
      });

      expect(response.status).toHaveBeenCalledWith(403);
      expect(update).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    },
  );

  test('recusa um token revogado antes de atualizar o CV', async () => {
    const response = await post(
      { cvName: 'cv.pdf', cvUrl: 'cvUrl/cand-1/cv.pdf' },
      { revoked: true },
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
