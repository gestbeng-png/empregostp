import { admin } from '../../../lib/firebaseAdmin';
import verifyActionHandler from '../../../pages/api/admin/verify-action';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
  });

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

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
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

function baseVerificationData(overrides: Record<string, unknown> = {}) {
  return {
    status: 'pending',
    uid: 'candidate-1',
    verificationItems: {
      identity: {
        checklist: [],
        label: 'Identidade',
        requested: true,
        status: 'pending',
      },
    },
    ...overrides,
  };
}

describe('aprovação de verificação exige CV e plano de verificação confirmados', () => {
  const verificationSet = jest.fn().mockResolvedValue(undefined);
  const activitiesAdd = jest.fn().mockResolvedValue({ id: 'act-1' });
  const userSet = jest.fn().mockResolvedValue(undefined);
  const profileSet = jest.fn().mockResolvedValue(undefined);
  let verificationData: Record<string, unknown>;
  let candidateUserData: Record<string, unknown>;

  function installFirestore() {
    const verificationRef = {
      get: jest.fn(async () => ({
        data: () => verificationData,
        exists: true,
      })),
      set: verificationSet,
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
            set: userSet,
          })),
        };
      }
      if (name === 'profiles') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ data: () => ({}) }),
            set: profileSet,
          })),
        };
      }
      if (name === 'verifications') {
        return { doc: jest.fn(() => verificationRef) };
      }
      if (name === 'activities') {
        return { doc: () => ({ set: activitiesAdd }) };
      }
      throw new Error(`Colecao inesperada: ${name}`);
    });

    const writes: Array<() => Promise<unknown>> = [];
    firestoreMock.mockReturnValue({
      collection,
      batch: () => ({
        set: (ref: { set: jest.Mock }, data: unknown, options: unknown) =>
          writes.push(() => ref.set(data, options)),
        commit: async () => {
          for (const write of writes) await write();
        },
      }),
    });
    return { verificationRef };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
    verificationData = baseVerificationData();
    candidateUserData = {
      currentPlan: 'verification_candidato',
      cvUrl: 'https://storage.example/cv.pdf',
    };
  });

  async function postAction(body: Record<string, unknown>) {
    const response = createResponse();
    await verifyActionHandler(
      {
        body: {
          action: 'approve',
          uid: 'candidate-1',
          verificationId: 'verification-1',
          ...body,
        },
        headers: { authorization: 'Bearer valid' },
        method: 'POST',
      },
      response,
    );
    return response;
  }

  test('bloqueia aprovação quando o candidato não tem CV anexado ao perfil', async () => {
    installFirestore();
    candidateUserData = { currentPlan: 'verification_candidato', cvUrl: '' };

    const response = await postAction({});

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VERIFICATION_MISSING_CV' }),
    );
    expect(verificationSet).not.toHaveBeenCalled();
  });

  test('bloqueia aprovação quando o plano atual já não inclui verificação (pagamento não confirmado)', async () => {
    installFirestore();
    candidateUserData = {
      currentPlan: 'basic_candidato',
      cvUrl: 'https://storage.example/cv.pdf',
    };

    const response = await postAction({});

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VERIFICATION_PLAN_NOT_ELIGIBLE' }),
    );
    expect(verificationSet).not.toHaveBeenCalled();
  });

  test('aprova normalmente quando há CV anexado e o plano confirma o pagamento', async () => {
    installFirestore();

    const response = await postAction({});

    expect(response.status).toHaveBeenCalledWith(200);
    expect(verificationSet).toHaveBeenCalled();
  });

  test('Premium (verificação incluída no plano) também consegue aprovar sem CV extra da submissão', async () => {
    installFirestore();
    candidateUserData = {
      currentPlan: 'unlimited_candidato',
      cvUrl: 'https://storage.example/cv.pdf',
    };

    const response = await postAction({});

    expect(response.status).toHaveBeenCalledWith(200);
  });

  test('rejeitar um pedido nunca é bloqueado pela falta de CV ou pagamento', async () => {
    installFirestore();
    candidateUserData = { currentPlan: 'basic_candidato', cvUrl: '' };

    const response = await postAction({
      action: 'reject',
      reason: 'Documento ilegível',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(verificationSet).toHaveBeenCalled();
  });

  test('desativa uma verificação aprovada e retira o selo em todos os campos', async () => {
    installFirestore();
    verificationData = baseVerificationData({
      status: 'approved',
      verificationItems: {
        identity: {
          checklist: [],
          label: 'Identidade',
          requested: true,
          status: 'approved',
        },
      },
    });
    // O registo gravado é relido depois do `set`; reflectir a escrita.
    verificationSet.mockImplementation(async (update) => {
      verificationData = { ...verificationData, ...update };
    });
    candidateUserData = { currentPlan: 'basic_candidato', cvUrl: '' };

    const response = await postAction({ action: 'revoke' });

    expect(response.status).toHaveBeenCalledWith(200);
    const saved = verificationSet.mock.calls[0][0];
    expect(saved.verificationItems.identity).toEqual(
      expect.objectContaining({ status: 'rejected', revokedBy: 'admin-1' }),
    );
    for (const setter of [userSet, profileSet]) {
      expect(setter).toHaveBeenCalledWith(
        expect.objectContaining({
          verified: false,
          verificado: false,
          isVerified: false,
          verificationStatus: 'rejected',
        }),
        { merge: true },
      );
    }
    verificationSet.mockReset();
    verificationSet.mockResolvedValue(undefined);
  });

  test('recusa desativar quando não há nada aprovado', async () => {
    installFirestore();

    const response = await postAction({ action: 'revoke' });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(verificationSet).not.toHaveBeenCalled();
  });
});
