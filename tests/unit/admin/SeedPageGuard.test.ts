import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import { getServerSideProps } from '../../../pages/setup/seed';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../lib/db', () => ({
  addDocument: jest.fn(),
  setDocument: jest.fn(),
}));

jest.mock('../../../lib/adminPageGuard', () => ({
  requireAdminPageAuth: jest.fn(),
}));

const mockedRequireAdminPageAuth = jest.mocked(requireAdminPageAuth);
const originalSeedFlag = process.env.ENABLE_DEV_SEED_PAGE;

describe('proteção da página de preparação de dados', () => {
  afterAll(() => {
    process.env.ENABLE_DEV_SEED_PAGE = originalSeedFlag;
  });

  test('responde 404 quando a ferramenta não está explicitamente ativada', async () => {
    delete process.env.ENABLE_DEV_SEED_PAGE;

    await expect(getServerSideProps({})).resolves.toEqual({ notFound: true });
    expect(mockedRequireAdminPageAuth).not.toHaveBeenCalled();
  });

  test('recusa uma sessão que não pertence a um administrador', async () => {
    process.env.ENABLE_DEV_SEED_PAGE = 'true';
    mockedRequireAdminPageAuth.mockResolvedValue({
      ok: false,
      redirect: { destination: '/login', permanent: false },
    });

    await expect(getServerSideProps({ req: {} })).resolves.toEqual({
      redirect: { destination: '/login', permanent: false },
    });
  });

  test('renderiza apenas depois de validar uma sessão de administrador', async () => {
    process.env.ENABLE_DEV_SEED_PAGE = 'true';
    mockedRequireAdminPageAuth.mockResolvedValue({
      ok: true,
      uid: 'admin-id',
      userData: { userType: 'admin' },
    });

    await expect(getServerSideProps({ req: {} })).resolves.toEqual({
      props: {},
    });
  });
});
