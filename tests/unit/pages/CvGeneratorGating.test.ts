import nookies from 'nookies';

import { admin } from '../../../lib/firebaseAdmin';
import { DEFAULT_TOOLS } from '../../../lib/resourcesCatalog';
import { getServerSideProps } from '../../../pages/recursos/gerador-cv';

jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

// A página é pesada do lado do cliente; o alvo aqui é só o guard de servidor.
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ loading: false, user: null }),
}));

jest.mock('../../../lib/firebase', () => ({
  app: {},
  auth: {},
  db: {},
  storage: {},
}));

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = jest.fn();
  const mockedAdmin = { auth: jest.fn(), firestore };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const cookiesGet = nookies.get as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function installUser(userData: Record<string, unknown> | null) {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
  });
  firestoreMock.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          data: () => userData,
          exists: userData !== null,
        }),
      })),
    })),
  });
}

describe('gating do gerador de CV', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookiesGet.mockReturnValue({ token: 'valid-token' });
  });

  test('visitante sem sessão é enviado para o login', async () => {
    cookiesGet.mockReturnValue({});

    const result = await getServerSideProps({} as never);

    expect(result).toEqual({
      redirect: { destination: '/login', permanent: false },
    });
  });

  test.each(['basic_candidato', 'verification_candidato'])(
    'candidato no plano %s é enviado para o upgrade',
    async (planId) => {
      installUser({ currentPlan: planId, planEndDate: null, userType: 'candidato' });

      const result = await getServerSideProps({} as never);

      expect(result).toEqual({
        redirect: { destination: '/premium/candidatos', permanent: false },
      });
    },
  );

  test.each(['professional_candidato', 'unlimited_candidato'])(
    'candidato no plano %s entra na ferramenta',
    async (planId) => {
      installUser({
        currentPlan: planId,
        planEndDate: new Date(Date.now() + 86_400_000),
        userType: 'candidato',
      });

      const result = await getServerSideProps({} as never);

      expect(result).toEqual({ props: {} });
    },
  );

  test('o administrador entra sem plano', async () => {
    installUser({ userType: 'admin' });

    const result = await getServerSideProps({} as never);

    expect(result).toEqual({ props: {} });
  });

  test('um plano pago expirado volta a ser bloqueado', async () => {
    installUser({
      currentPlan: 'professional_candidato',
      planEndDate: new Date(Date.now() - 86_400_000),
      userType: 'candidato',
    });

    const result = await getServerSideProps({} as never);

    expect(result).toEqual({
      redirect: { destination: '/premium/candidatos', permanent: false },
    });
  });
});

describe('catálogo de recursos', () => {
  const cvTools = DEFAULT_TOOLS.filter(
    (tool: { link?: string }) => tool.link === '/recursos/gerador-cv',
  );

  test('o gerador de CV aparece uma única vez', () => {
    expect(cvTools).toHaveLength(1);
  });

  test('está marcado como exclusivo de plano pago', () => {
    expect(cvTools[0]?.requiresProfessional).toBe(true);
  });

  test('nenhuma ferramenta anuncia o gerador de CV como gratuito', () => {
    const freeCvTools = DEFAULT_TOOLS.filter(
      (tool: { link?: string; requiresProfessional?: boolean }) =>
        tool.link === '/recursos/gerador-cv' && !tool.requiresProfessional,
    );
    expect(freeCvTools).toEqual([]);
  });
});
