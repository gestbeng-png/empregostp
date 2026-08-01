import { admin } from '../../../lib/firebaseAdmin';
import handler from '../../../pages/api/files/candidate-cv';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = jest.fn();
  const mockedAdmin = {
    app: jest.fn(() => ({ options: { storageBucket: 'test-bucket' } })),
    auth: jest.fn(),
    firestore,
    storage: jest.fn(),
  };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const storageMock = admin.storage as unknown as jest.Mock;

const CV_URL =
  'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/cvUrl%2Fcand-1%2F1700000000_cv.pdf?alt=media&token=legacy';

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

const getSignedUrl = jest.fn();
const exists = jest.fn();

type UserDoc = Record<string, unknown>;

function installFirestore({
  candidateProfile = {
    cvUrl: CV_URL,
    settings: { privacy: { profileVisibility: 'recruiters', showContactInfo: true } },
  } as UserDoc,
  candidateUser = { userType: 'candidato' } as UserDoc,
  viewerUser = {
    currentPlan: 'unlimited_empresa',
    planEndDate: null,
    userType: 'empresa',
  } as UserDoc,
}: {
  candidateProfile?: UserDoc;
  candidateUser?: UserDoc;
  viewerUser?: UserDoc;
} = {}) {
  const collection = jest.fn((name: string) => ({
    doc: jest.fn((uid: string) => ({
      get: jest.fn().mockResolvedValue({
        data: () => {
          if (name === 'profiles') return candidateProfile;
          return uid === 'cand-1' ? candidateUser : viewerUser;
        },
        exists: true,
      }),
    })),
  }));
  firestoreMock.mockReturnValue({ collection });
}

function installStorage() {
  exists.mockResolvedValue([true]);
  getSignedUrl.mockResolvedValue([
    'https://storage.googleapis.com/signed/cv.pdf?X-Goog-Expires=300',
  ]);
  storageMock.mockReturnValue({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({ exists, getSignedUrl })),
      name: 'test-bucket',
    })),
  });
}

async function post(body: Record<string, unknown>, uid = 'company-1') {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid }),
  });
  const response = createResponse();
  await handler(
    {
      body,
      headers: { authorization: 'Bearer valid' },
      method: 'POST',
    },
    response,
  );
  return response;
}

describe('rota de URL assinado do CV', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installStorage();
  });

  test('assina um URL de curta duração para a empresa autorizada', async () => {
    installFirestore();

    const response = await post({ candidateId: 'cand-1' });

    expect(response.status).toHaveBeenCalledWith(200);
    const payload = response.json.mock.calls[0][0];
    expect(payload.url).toContain('signed');
    expect(typeof payload.expiresAt).toBe('string');

    const signOptions = getSignedUrl.mock.calls[0][0];
    expect(signOptions.action).toBe('read');
    // Curta duração: no máximo 15 minutos.
    expect(signOptions.expires - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(signOptions.expires - Date.now()).toBeGreaterThan(0);
  });

  test('a resposta nunca devolve o URL público de longa duração', async () => {
    installFirestore();

    const response = await post({ candidateId: 'cand-1' });

    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'firebasestorage.googleapis.com',
    );
  });

  test('recusa a empresa sem a funcionalidade no plano', async () => {
    installFirestore({
      viewerUser: {
        currentPlan: 'basic_empresa',
        planEndDate: null,
        userType: 'empresa',
      },
    });

    const response = await post({ candidateId: 'cand-1' });

    expect(response.status).toHaveBeenCalledWith(403);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test('recusa quando o candidato não partilha o contacto', async () => {
    installFirestore({
      candidateProfile: {
        cvUrl: CV_URL,
        settings: {
          privacy: { profileVisibility: 'recruiters', showContactInfo: false },
        },
      },
    });

    const response = await post({ candidateId: 'cand-1' });

    expect(response.status).toHaveBeenCalledWith(403);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test('recusa outro candidato a espreitar o CV', async () => {
    installFirestore({
      viewerUser: { userType: 'candidato' },
    });

    const response = await post({ candidateId: 'cand-1' }, 'cand-2');

    expect(response.status).toHaveBeenCalledWith(403);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test('o próprio candidato acede ao seu CV mesmo com perfil privado', async () => {
    installFirestore({
      candidateProfile: {
        cvUrl: CV_URL,
        settings: {
          privacy: { profileVisibility: 'private', showContactInfo: false },
        },
      },
      viewerUser: { userType: 'candidato' },
    });

    const response = await post({ candidateId: 'cand-1' }, 'cand-1');

    expect(response.status).toHaveBeenCalledWith(200);
    expect(getSignedUrl).toHaveBeenCalled();
  });

  test('recusa um cvUrl forjado que aponta para o ficheiro de outra pessoa', async () => {
    installFirestore({
      candidateProfile: {
        cvUrl:
          'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/payment-proofs%2Fvitima%2Fproof.pdf?alt=media&token=t',
        settings: {
          privacy: { profileVisibility: 'recruiters', showContactInfo: true },
        },
      },
    });

    const response = await post({ candidateId: 'cand-1' });

    expect(response.status).toHaveBeenCalledWith(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test('devolve 404 quando o candidato não tem CV', async () => {
    installFirestore({
      candidateProfile: {
        settings: {
          privacy: { profileVisibility: 'recruiters', showContactInfo: true },
        },
      },
    });

    const response = await post({ candidateId: 'cand-1' });

    expect(response.status).toHaveBeenCalledWith(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test('exige autenticação e o método POST', async () => {
    installFirestore();

    const unauthenticated = createResponse();
    await handler(
      { body: { candidateId: 'cand-1' }, headers: {}, method: 'POST' },
      unauthenticated,
    );
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    const wrongMethod = createResponse();
    await handler(
      {
        body: {},
        headers: { authorization: 'Bearer valid' },
        method: 'GET',
      },
      wrongMethod,
    );
    expect(wrongMethod.status).toHaveBeenCalledWith(405);
    expect(wrongMethod.setHeader).toHaveBeenCalledWith('Allow', 'POST');
  });

  test('exige um candidateId válido no corpo', async () => {
    installFirestore();

    const response = await post({});

    expect(response.status).toHaveBeenCalledWith(400);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
