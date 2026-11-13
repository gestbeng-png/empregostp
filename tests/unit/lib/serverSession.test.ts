import nookies from 'nookies';

import { admin } from '../../../lib/firebaseAdmin';
import {
  requireCandidateSession,
  requireSession,
} from '../../../lib/serverSession';

jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../../lib/firebaseAdmin', () => {
  const mockedAdmin = { auth: jest.fn(), firestore: jest.fn() };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

const cookiesGet = nookies.get as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function mockUser(data: Record<string, unknown> = { userType: 'candidato' }) {
  firestoreMock.mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => data,
          exists: true,
        }),
      }),
    }),
  });
}

describe('requireSession', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deixa passar quando a sessão é válida', async () => {
    cookiesGet.mockReturnValue({ token: 'tok' });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
    });
    mockUser();

    await expect(
      requireSession({ resolvedUrl: '/dashboard/candidato' }),
    ).resolves.toBeNull();
    expect(authMock().verifyIdToken).toHaveBeenCalledWith('tok', true);
  });

  test.each(['inactive', 'suspended', 'disabled'])(
    'nega uma conta com status %s',
    async (status) => {
      cookiesGet.mockReturnValue({ token: 'tok' });
      authMock.mockReturnValue({
        verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
      });
      mockUser({ status, userType: 'candidato' });

      const result = await requireSession({
        resolvedUrl: '/dashboard/candidato',
      });

      expect(result?.redirect.destination).toBe(
        '/login?redirect=%2Fdashboard%2Fcandidato',
      );
    },
  );

  test('mantém compatibilidade com perfis antigos sem status', async () => {
    cookiesGet.mockReturnValue({ token: 'tok' });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
    });
    mockUser({ userType: 'candidato' });

    await expect(
      requireSession({ resolvedUrl: '/dashboard/candidato' }),
    ).resolves.toBeNull();
  });

  test('sem cookie, manda ao login guardando o destino', async () => {
    cookiesGet.mockReturnValue({});

    await expect(
      requireSession({ resolvedUrl: '/dashboard/candidato?tab=plans' }),
    ).resolves.toEqual({
      redirect: {
        destination: '/login?redirect=%2Fdashboard%2Fcandidato%3Ftab%3Dplans',
        permanent: false,
      },
    });
  });

  test('token inválido é tratado como ausência de sessão', async () => {
    cookiesGet.mockReturnValue({ token: 'expirado' });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('expirado')),
    });

    const result = await requireSession({ resolvedUrl: '/profile' });

    expect(result?.redirect.destination).toBe('/login?redirect=%2Fprofile');
  });

  test('não deixa passar quando o Firebase falha, para o guard não abrir sozinho', async () => {
    cookiesGet.mockReturnValue({ token: 'tok' });
    authMock.mockImplementation(() => {
      throw new Error('admin indisponível');
    });

    const result = await requireSession({ resolvedUrl: '/dashboard' });

    expect(result?.redirect.destination).toBe('/login?redirect=%2Fdashboard');
  });
});

describe('requireCandidateSession', () => {
  beforeEach(() => jest.clearAllMocks());

  function comSessao(userType: string) {
    cookiesGet.mockReturnValue({ token: 'tok' });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
    });
    mockUser({ userType });
  }

  test('deixa passar um candidato', async () => {
    comSessao('candidato');

    await expect(
      requireCandidateSession({ resolvedUrl: '/dashboard/candidato' }),
    ).resolves.toBeNull();
  });

  test('o HTML e os dados SSR privados não podem ser reutilizados por cache', async () => {
    comSessao('candidato');
    const setHeader = jest.fn();
    await requireCandidateSession({ resolvedUrl: '/dashboard/candidato', res: { setHeader } });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store, max-age=0');
  });

  test.each(['empresa', 'admin'])(
    'reencaminha %s para o seu próprio painel em vez de o deixar preencher o formulário',
    async (userType) => {
      comSessao(userType);

      const result = await requireCandidateSession({
        resolvedUrl: '/dashboard/candidato',
      });

      expect(result).toEqual({
        redirect: { destination: '/dashboard', permanent: false },
      });
    },
  );

  test('sem sessão vai para o login com o destino preservado', async () => {
    cookiesGet.mockReturnValue({});

    const result = await requireCandidateSession({
      resolvedUrl: '/dashboard/candidato',
    });

    expect(result?.redirect.destination).toBe(
      '/login?redirect=%2Fdashboard%2Fcandidato',
    );
  });
});
