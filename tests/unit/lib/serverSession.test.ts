import nookies from 'nookies';

import { admin } from '../../../lib/firebaseAdmin';
import { requireSession } from '../../../lib/serverSession';

jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../../lib/firebaseAdmin', () => {
  const mockedAdmin = { auth: jest.fn() };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

const cookiesGet = nookies.get as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;

describe('requireSession', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deixa passar quando a sessão é válida', async () => {
    cookiesGet.mockReturnValue({ token: 'tok' });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
    });

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
