import { admin } from '../../../lib/firebaseAdmin';
import verifyActionHandler from '../../../pages/api/admin/verify-action';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
  });
  return { admin: { auth: jest.fn(), firestore } };
});

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue({ id: 'n-1' }),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

/** O dono legítimo do pedido de verificação: tem CV e plano que a inclui. */
const DONO = 'candidato-dono';
/** Uma vítima que nunca submeteu nem pagou nada. */
const VITIMA = 'candidato-vitima';

function installFirestore() {
  const verificationSet = jest.fn().mockResolvedValue(undefined);
  const userSets = new Map<string, jest.Mock>();
  const profileSets = new Map<string, jest.Mock>();

  const verificationRef = {
    get: jest.fn().mockResolvedValue({
      data: () => ({
        status: 'pending',
        uid: DONO,
        verificationItems: {
          identity: {
            checklist: [],
            label: 'Identidade',
            requested: true,
            status: 'pending',
          },
        },
      }),
      exists: true,
    }),
    set: verificationSet,
  };

  const collection = jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn((uid: string) => {
          if (!userSets.has(uid)) {
            userSets.set(uid, jest.fn().mockResolvedValue(undefined));
          }
          return {
            get: jest.fn().mockResolvedValue(
              uid === 'admin-1'
                ? { data: () => ({ userType: 'admin' }), exists: true }
                : {
                    data: () => ({
                      currentPlan: 'verification_candidato',
                      cvUrl: 'https://storage.example/cv.pdf',
                    }),
                    exists: true,
                  },
            ),
            set: userSets.get(uid),
          };
        }),
      };
    }
    if (name === 'profiles') {
      return {
        doc: jest.fn((uid: string) => {
          if (!profileSets.has(uid)) {
            profileSets.set(uid, jest.fn().mockResolvedValue(undefined));
          }
          return {
            get: jest.fn().mockResolvedValue({ data: () => ({}) }),
            set: profileSets.get(uid),
          };
        }),
      };
    }
    if (name === 'verifications')
      return { doc: jest.fn(() => verificationRef) };
    if (name === 'activities') {
      return { doc: () => ({ set: jest.fn().mockResolvedValue(undefined) }) };
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
  return { profileSets, userSets, verificationSet };
}

async function aprovar(uid: string) {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
  });
  const response = createResponse();
  await verifyActionHandler(
    {
      body: { action: 'approve', uid, verificationId: 'verificacao-1' },
      headers: { authorization: 'Bearer valido' },
      method: 'POST',
    } as never,
    response as never,
  );
  return response;
}

describe('acção de verificação só pode atingir o dono do pedido', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uid divergente do pedido é recusado e a vítima não é tocada', async () => {
    const { profileSets, userSets, verificationSet } = installFirestore();

    const response = await aprovar(VITIMA);

    expect(response.status).toHaveBeenCalledWith(400);
    // Nada foi escrito: nem no registo, nem na vítima.
    expect(verificationSet).not.toHaveBeenCalled();
    expect(userSets.get(VITIMA)).toBeUndefined();
    expect(profileSets.get(VITIMA)).toBeUndefined();
  });

  test('uid coincidente continua a aprovar normalmente', async () => {
    const { userSets, verificationSet } = installFirestore();

    const response = await aprovar(DONO);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(verificationSet).toHaveBeenCalled();
    expect(userSets.get(DONO)).toHaveBeenCalled();
  });
});
