import nookies from 'nookies';

import { admin } from '../../../lib/firebaseAdmin';
import { getServerSideProps as premiumProps } from '../../../pages/premium';
import { getServerSideProps as candidatosProps } from '../../../pages/premium/candidatos';
import { getServerSideProps as empresaProps } from '../../../pages/premium/empresa';

jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../../lib/firebaseAdmin', () => {
  const mockedAdmin = { auth: jest.fn(), firestore: jest.fn() };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const cookiesGet = nookies.get as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function withSession(
  valid = true,
  userType = 'candidato',
  status = 'active',
  exists = true,
) {
  cookiesGet.mockReturnValue({ token: 'tok' });
  authMock.mockReturnValue({
    verifyIdToken: valid
      ? jest.fn().mockResolvedValue({ uid: 'user-1' })
      : jest.fn().mockRejectedValue(new Error('expirado')),
  });
  firestoreMock.mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: () => ({ userType, status }),
          exists,
        }),
      }),
    }),
  });
}

describe('encaminhamento das páginas de planos', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    [
      'candidatos',
      candidatosProps,
      '/dashboard/candidato?tab=plans',
      'candidato',
    ],
    ['empresa', empresaProps, '/dashboard/empresa?tab=plans', 'empresa'],
  ])(
    'com sessão, /premium/%s leva à tab de planos',
    async (_nome, handler, destino, userType) => {
      withSession(true, userType);

      const result = await handler({} as never);

      expect(result).toEqual({
        redirect: { destination: destino, permanent: false },
      });
    },
  );

  test.each([
    ['candidatos', candidatosProps, '/dashboard/candidato?tab=plans'],
    ['empresa', empresaProps, '/dashboard/empresa?tab=plans'],
  ])(
    'sem sessão, /premium/%s leva ao login preservando os planos como destino',
    async (_nome, handler, destino) => {
      cookiesGet.mockReturnValue({});

      const result = await handler({} as never);

      expect(result.redirect.permanent).toBe(false);
      // O visitante não pode aterrar num dashboard que não pode usar: vai ao
      // login, mas a tab de planos fica guardada como destino de retorno.
      expect(result.redirect.destination).toBe(
        `/login?redirect=${encodeURIComponent(destino)}`,
      );
    },
  );

  test.each([
    ['candidatos', candidatosProps],
    ['empresa', empresaProps],
  ])(
    'sessão inválida em /premium/%s também vai para o login',
    async (_nome, handler) => {
      withSession(false);

      const result = await handler({} as never);

      expect(result.redirect.destination.startsWith('/login?redirect=')).toBe(
        true,
      );
    },
  );

  test.each([
    ['candidatos', candidatosProps, 'empresa'],
    ['candidatos', candidatosProps, 'admin'],
    ['empresa', empresaProps, 'candidato'],
    ['empresa', empresaProps, 'admin'],
    ['candidatos', candidatosProps, 'desconhecido'],
  ])(
    'planos de %s não abrem o painel de um perfil incompatível',
    async (_page, handler, userType) => {
      withSession(true, userType);
      await expect(handler({} as never)).resolves.toEqual({
        redirect: { destination: '/dashboard', permanent: false },
      });
    },
  );

  test.each([
    ['candidatos', candidatosProps, 'candidato'],
    ['empresa', empresaProps, 'empresa'],
  ])(
    'perfil suspenso ou inexistente não acede aos planos de %s',
    async (_page, handler, userType) => {
      withSession(true, userType, 'suspended');
      expect((await handler({} as never)).redirect.destination).toMatch(
        /^\/login\?/,
      );
      withSession(true, userType, 'active', false);
      expect((await handler({} as never)).redirect.destination).toMatch(
        /^\/login\?/,
      );
    },
  );

  test.each([candidatosProps, empresaProps])(
    'verifica revogação no servidor antes de decidir o destino',
    async (handler) => {
      withSession();
      await handler({} as never);
      expect(authMock().verifyIdToken).toHaveBeenCalledWith('tok', true);
    },
  );

  test.each([
    ['candidato', '/dashboard/candidato?tab=plans'],
    ['empresa', '/dashboard/empresa?tab=plans'],
    ['admin', '/dashboard/admin'],
  ])(
    '/premium decide no servidor o destino do perfil %s',
    async (userType, destination) => {
      withSession(true, userType);
      await expect(premiumProps({ resolvedUrl: '/premium' })).resolves.toEqual({
        redirect: { destination, permanent: false },
      });
    },
  );

  test('/premium sem sessão não fica à espera da validação do browser', async () => {
    cookiesGet.mockReturnValue({});
    await expect(premiumProps({ resolvedUrl: '/premium' })).resolves.toEqual({
      redirect: { destination: '/login?redirect=%2Fpremium', permanent: false },
    });
  });
});
