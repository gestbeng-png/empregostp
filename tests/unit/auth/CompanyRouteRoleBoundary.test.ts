import { getServerSideProps as adminDashboardProps } from '../../../pages/dashboard/admin';
import { getServerSideProps as adminCreateProps } from '../../../pages/dashboard/admin/jobs/create';
import { getServerSideProps as candidateDashboardProps } from '../../../pages/dashboard/candidato';
import { getServerSideProps as companyDashboardProps } from '../../../pages/dashboard/empresa';
import { getServerSideProps as companyCandidateProps } from '../../../pages/dashboard/empresa/candidato/[id]';
import { getServerSideProps as companyProfileProps } from '../../../pages/dashboard/empresa/profile';
import { getServerSideProps as companyCreateProps } from '../../../pages/dashboard/empresa/vaga/criar-vaga';
import { getServerSideProps as companyJobsProps } from '../../../pages/dashboard/empresa/vagas';

const mockVerifyToken = jest.fn();
const mockCollection = jest.fn();
const mockGetUser = jest.fn();
jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: () => ({ token: 'synthetic-token' }) },
}));
jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: () => ({ verifyIdToken: mockVerifyToken }),
    firestore: () => ({ collection: mockCollection }),
  },
}));
jest.mock('../../../lib/firebase', () => ({ auth: {}, storage: {}, db: {} }));
jest.mock('../../../lib/webPushClient', () => ({}));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyToken.mockResolvedValue({ uid: 'synthetic-account' });
  mockGetUser.mockResolvedValue({
    exists: true,
    data: () => ({ userType: 'admin', status: 'active' }),
  });
  mockCollection.mockReturnValue({ doc: () => ({ get: mockGetUser }) });
});

test.each([
  ['criar vaga', companyCreateProps, '/dashboard/empresa/vaga/criar-vaga'],
  [
    'editar vaga',
    companyCreateProps,
    '/dashboard/empresa/vaga/criar-vaga?edit=synthetic-job',
  ],
  ['perfil da empresa', companyProfileProps, '/dashboard/empresa/profile'],
  ['vagas da empresa', companyJobsProps, '/dashboard/empresa/vagas'],
  [
    'candidato no painel empresarial',
    companyCandidateProps,
    '/dashboard/empresa/candidato/synthetic-candidate',
  ],
])(
  'sessão admin não renderiza a rota empresarial de %s',
  async (_label, handler, resolvedUrl) => {
    await expect(
      handler({ resolvedUrl, params: { id: 'synthetic-candidate' } } as never),
    ).resolves.toEqual({
      redirect: { destination: '/dashboard', permanent: false },
    });
    expect(mockVerifyToken).toHaveBeenCalledWith('synthetic-token', true);
    expect(mockCollection.mock.calls).toEqual([['users']]);
  },
);

test('empresa continua a abrir o formulário empresarial', async () => {
  mockGetUser.mockResolvedValue({
    exists: true,
    data: () => ({ userType: 'empresa', status: 'active' }),
  });
  await expect(
    companyCreateProps({ resolvedUrl: '/dashboard/empresa/vaga/criar-vaga' }),
  ).resolves.toEqual({ props: {} });
});

test('admin continua a criar vagas na sua rota própria, sem assumir perfil empresarial', async () => {
  mockCollection.mockReturnValue({
    doc: () => ({ get: mockGetUser }),
    where: () => ({
      get: async () => ({
        docs: [
          {
            id: 'synthetic-company',
            data: () => ({ name: 'Empresa de teste' }),
          },
        ],
      }),
    }),
  });
  await expect(
    adminCreateProps({ resolvedUrl: '/dashboard/admin/jobs/create' }),
  ).resolves.toEqual({
    props: {
      companies: [
        { id: 'synthetic-company', name: 'Empresa de teste', logo: '' },
      ],
    },
  });
});

test.each([
  ['admin', '/dashboard/candidato', candidateDashboardProps],
  ['empresa', '/dashboard/candidato', candidateDashboardProps],
  ['admin', '/dashboard/empresa', companyDashboardProps],
  ['candidato', '/dashboard/empresa', companyDashboardProps],
  ['empresa', '/dashboard/admin', adminDashboardProps],
  ['candidato', '/dashboard/admin', adminDashboardProps],
])(
  'SSR: conta %s não recebe HTML nem dados privados de %s',
  async (userType, resolvedUrl, handler) => {
    mockGetUser.mockResolvedValue({
      exists: true,
      data: () => ({ userType, status: 'active' }),
    });
    const setHeader = jest.fn();
    await expect(
      handler({ resolvedUrl, res: { setHeader } } as never),
    ).resolves.toEqual({
      redirect: { destination: '/dashboard', permanent: false },
    });
    expect(mockVerifyToken).toHaveBeenCalledWith('synthetic-token', true);
    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, max-age=0',
    );
    expect(mockCollection.mock.calls).toEqual([['users']]);
  },
);

test('SSR do candidato mantém o acesso legítimo do candidato', async () => {
  mockGetUser.mockResolvedValue({
    exists: true,
    data: () => ({ userType: 'candidato', status: 'active' }),
  });
  await expect(
    candidateDashboardProps({ resolvedUrl: '/dashboard/candidato' }),
  ).resolves.toEqual({ props: {} });
});
