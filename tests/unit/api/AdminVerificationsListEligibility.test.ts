import { admin } from '../../../lib/firebaseAdmin';
import adminVerificationsHandler from '../../../pages/api/admin/verifications';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = jest.fn();
  return {
    admin: {
      auth: jest.fn(),
      firestore,
    },
  };
});

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

describe('listagem admin de verificações inclui CV e elegibilidade de pagamento', () => {
  function installFirestore({
    candidateUserData,
  }: {
    candidateUserData: Record<string, unknown>;
  }) {
    const verificationDoc = {
      data: () => ({
        status: 'pending',
        submittedAt: null,
        uid: 'candidate-1',
        updatedAt: null,
        verificationItems: {},
      }),
      id: 'verification-1',
    };

    const collection = jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn((uid: string) => ({
            get: jest
              .fn()
              .mockResolvedValue(
                uid === 'admin-1'
                  ? { data: () => ({ userType: 'admin' }), exists: true }
                  : { data: () => candidateUserData, exists: true },
              ),
          })),
        };
      }
      if (name === 'verifications') {
        return {
          get: jest.fn().mockResolvedValue({ docs: [verificationDoc] }),
        };
      }
      if (name === 'profiles') {
        return {
          doc: () => ({
            get: jest.fn().mockResolvedValue({ data: () => ({}) }),
          }),
        };
      }
      throw new Error(`Colecao inesperada: ${name}`);
    });

    firestoreMock.mockReturnValue({ collection });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
  });

  async function getVerifications() {
    const response = createResponse();
    await adminVerificationsHandler(
      {
        headers: { authorization: 'Bearer valid' },
        method: 'GET',
      },
      response,
    );
    return response;
  }

  test('candidato com CV e plano Verificação aparece elegível para aprovação', async () => {
    installFirestore({
      candidateUserData: {
        currentPlan: 'verification_candidato',
        cvUrl: 'https://storage.example/cv.pdf',
        name: 'Candidata Teste',
      },
    });

    const response = await getVerifications();
    const payload = response.json.mock.calls[0][0];

    expect(payload.verifications[0].cvUrl).toBe(
      'https://storage.example/cv.pdf',
    );
    expect(payload.verifications[0].approvalEligibility).toEqual(
      expect.objectContaining({ allowed: true }),
    );
  });

  test('candidato sem CV aparece não elegível, com motivo explícito', async () => {
    installFirestore({
      candidateUserData: {
        currentPlan: 'verification_candidato',
        cvUrl: '',
        name: 'Candidato Sem CV',
      },
    });

    const response = await getVerifications();
    const payload = response.json.mock.calls[0][0];

    expect(payload.verifications[0].approvalEligibility.allowed).toBe(false);
    expect(payload.verifications[0].approvalEligibility.code).toBe(
      'VERIFICATION_MISSING_CV',
    );
  });

  test('candidato cujo plano já não inclui verificação aparece não elegível', async () => {
    installFirestore({
      candidateUserData: {
        currentPlan: 'basic_candidato',
        cvUrl: 'https://storage.example/cv.pdf',
        name: 'Candidato Básico',
      },
    });

    const response = await getVerifications();
    const payload = response.json.mock.calls[0][0];

    expect(payload.verifications[0].approvalEligibility.allowed).toBe(false);
    expect(payload.verifications[0].approvalEligibility.code).toBe(
      'VERIFICATION_PLAN_NOT_ELIGIBLE',
    );
  });
});
