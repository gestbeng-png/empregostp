import type { GetServerSidePropsContext } from 'next';

const verifyIdToken = jest.fn();
const getUserDoc = jest.fn();

jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: () => mockCookies },
  get: () => mockCookies,
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: () => ({ verifyIdToken }),
    firestore: () => ({
      collection: () => ({ doc: () => ({ get: getUserDoc }) }),
    }),
  },
}));

let mockCookies: Record<string, string> = {};

import { requireCompanySession } from '../../../lib/serverSession';

const contexto = {
  resolvedUrl: '/dashboard/empresa/vaga/criar-vaga',
} as unknown as GetServerSidePropsContext;

function utilizador(dados: Record<string, unknown> | null) {
  getUserDoc.mockResolvedValue({
    exists: dados !== null,
    data: () => dados,
  });
}

describe('guard das páginas de empresa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies = { token: 'token-valido' };
    verifyIdToken.mockResolvedValue({ uid: 'empresa-1' });
    utilizador({ userType: 'empresa', status: 'active' });
  });

  test('sem sessão, manda para o login com o destino guardado', async () => {
    mockCookies = {};

    await expect(requireCompanySession(contexto)).resolves.toEqual({
      redirect: {
        destination:
          '/login?redirect=%2Fdashboard%2Fempresa%2Fvaga%2Fcriar-vaga',
        permanent: false,
      },
    });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test('token recusado também vai para o login', async () => {
    verifyIdToken.mockRejectedValue(new Error('token expirado'));

    const resultado = await requireCompanySession(contexto);

    expect(resultado).toMatchObject({
      redirect: { destination: expect.stringContaining('/login') },
    });
  });

  test('sessão de candidato vai para o próprio painel, não para o formulário', async () => {
    utilizador({ userType: 'candidato', status: 'active' });

    await expect(requireCompanySession(contexto)).resolves.toEqual({
      redirect: { destination: '/dashboard', permanent: false },
    });
  });

  test('conta suspensa não passa', async () => {
    utilizador({ userType: 'empresa', status: 'suspended' });

    const resultado = await requireCompanySession(contexto);

    expect(resultado).toMatchObject({
      redirect: { destination: expect.stringContaining('/login') },
    });
  });

  test('empresa com sessão activa passa', async () => {
    await expect(requireCompanySession(contexto)).resolves.toBeNull();
  });

  test('admin também passa, para poder rever o formulário', async () => {
    utilizador({ userType: 'admin', status: 'active' });

    await expect(requireCompanySession(contexto)).resolves.toBeNull();
  });
});
