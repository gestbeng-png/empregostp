import fs from 'node:fs';
import path from 'node:path';

import { admin } from '../../../lib/firebaseAdmin';
import handler from '../../../pages/api/files/candidate-certificate';

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

const CERTIFICATE_URL =
  'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/certificados%2Fcand-1%2F1700000000_diploma.pdf?alt=media&token=permanent';

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

type UserDoc = Record<string, unknown>;

function installFirestore({
  candidateProfile = {
    certificateFiles: [CERTIFICATE_URL],
    settings: {
      privacy: { profileVisibility: 'recruiters', showContactInfo: true },
    },
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

const getSignedUrl = jest.fn();
const exists = jest.fn();

function installStorage() {
  exists.mockResolvedValue([true]);
  getSignedUrl.mockResolvedValue([
    'https://storage.googleapis.com/signed/diploma.pdf?X-Goog-Expires=300',
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

describe('rota privada de certificados do candidato', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installStorage();
  });

  test('assina apenas o certificado selecionado para empresa autorizada', async () => {
    installFirestore();

    const response = await post({
      candidateId: 'cand-1',
      certificateIndex: 0,
    });

    expect(response.status).toHaveBeenCalledWith(200);
    const payload = response.json.mock.calls[0][0];
    expect(payload.url).toContain('/signed/diploma.pdf');
    expect(payload.fileName).toBe('1700000000_diploma.pdf');
    expect(JSON.stringify(payload)).not.toContain('token=permanent');

    const signOptions = getSignedUrl.mock.calls[0][0];
    expect(signOptions.action).toBe('read');
    expect(signOptions.expires - Date.now()).toBeGreaterThan(0);
    expect(signOptions.expires - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  test('recusa empresa sem plano ou sem consentimento de contacto', async () => {
    installFirestore({
      viewerUser: {
        currentPlan: 'basic_empresa',
        planEndDate: null,
        userType: 'empresa',
      },
    });
    const withoutPlan = await post({
      candidateId: 'cand-1',
      certificateIndex: 0,
    });
    expect(withoutPlan.status).toHaveBeenCalledWith(403);

    installFirestore({
      candidateProfile: {
        certificateFiles: [CERTIFICATE_URL],
        settings: {
          privacy: {
            profileVisibility: 'recruiters',
            showContactInfo: false,
          },
        },
      },
    });
    const privateContact = await post({
      candidateId: 'cand-1',
      certificateIndex: 0,
    });
    expect(privateContact.status).toHaveBeenCalledWith(403);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test('o próprio candidato pode abrir o certificado com perfil privado', async () => {
    installFirestore({
      candidateProfile: {
        certificateFiles: [CERTIFICATE_URL],
        settings: {
          privacy: { profileVisibility: 'private', showContactInfo: false },
        },
      },
    });

    const response = await post(
      { candidateId: 'cand-1', certificateIndex: 0 },
      'cand-1',
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  test('não assina caminho forjado, índice inexistente ou inválido', async () => {
    installFirestore({
      candidateProfile: {
        certificateFiles: [
          'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/payment-proofs%2Fvictim%2Fproof.pdf?alt=media&token=t',
        ],
        settings: {
          privacy: { profileVisibility: 'recruiters', showContactInfo: true },
        },
      },
    });
    const forged = await post({
      candidateId: 'cand-1',
      certificateIndex: 0,
    });
    expect(forged.status).toHaveBeenCalledWith(404);

    installFirestore();
    const missing = await post({
      candidateId: 'cand-1',
      certificateIndex: 5,
    });
    expect(missing.status).toHaveBeenCalledWith(404);

    const invalid = await post({
      candidateId: 'cand-1',
      certificateIndex: -1,
    });
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  test('exige sessão válida e anuncia POST no método incorreto', async () => {
    installFirestore();

    const unauthenticated = createResponse();
    await handler(
      {
        body: { candidateId: 'cand-1', certificateIndex: 0 },
        headers: {},
        method: 'POST',
      },
      unauthenticated,
    );
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    const wrongMethod = createResponse();
    await handler({ body: {}, headers: {}, method: 'GET' }, wrongMethod);
    expect(wrongMethod.status).toHaveBeenCalledWith(405);
    expect(wrongMethod.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
  });

  test('o SSR empresarial nunca serializa nem renderiza os URLs permanentes', () => {
    const pageSource = fs.readFileSync(
      path.join(
        process.cwd(),
        'pages',
        'dashboard',
        'empresa',
        'candidato',
        '[id].js',
      ),
      'utf8',
    );

    expect(pageSource).toContain('certificateCount:');
    expect(pageSource).not.toContain('href={certUrl}');
    expect(pageSource).not.toMatch(
      /certificateFiles\s*:\s*Array\.isArray\(profileData\.certificateFiles\)/,
    );
  });
});
