import { admin } from '../../../lib/firebaseAdmin';
import { logServerWarning } from '../../../lib/serverLog';
import handler from '../../../pages/api/export/applications';

jest.mock('../../../lib/firebaseAdmin', () => {
  const mockedAdmin = { auth: jest.fn(), firestore: jest.fn() };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const mockedWarning = jest.mocked(logServerWarning);

function createResponse() {
  const response = {
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.send.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

const DOCS = [
  {
    data: () => ({
      candidateEmail: 'b@example.test',
      candidateName: 'Bravo',
      createdAt: { toDate: () => new Date('2026-02-01T00:00:00Z') },
      jobTitle: 'Vaga B',
      status: 'pending',
    }),
    id: 'app-b',
  },
  {
    data: () => ({
      candidateEmail: 'a@example.test',
      candidateName: 'Alfa',
      createdAt: { toDate: () => new Date('2026-03-01T00:00:00Z') },
      jobTitle: 'Vaga A',
      status: 'accepted',
    }),
    id: 'app-a',
  },
];

function installFirestore({ indexMissing = false } = {}) {
  const missing = Object.assign(new Error('The query requires an index.'), { code: 9 });
  const base = {
    get: jest.fn().mockResolvedValue({ docs: DOCS }),
    orderBy: jest.fn(),
    where: jest.fn(),
  };
  base.where.mockReturnValue(base);
  base.orderBy.mockReturnValue({
    get: indexMissing
      ? jest.fn().mockRejectedValue(missing)
      : jest.fn().mockResolvedValue({ docs: DOCS }),
  });

  firestoreMock.mockReturnValue({
    collection: jest.fn((name: string) => {
      if (name === 'applications') return base;
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => ({
              currentPlan: 'unlimited_empresa',
              planEndDate: null,
              userType: 'empresa',
            }),
            exists: true,
          }),
        })),
      };
    }),
  });
  return base;
}

async function get() {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'company-1' }),
  });
  const response = createResponse();
  await handler(
    { headers: { authorization: 'Bearer valid' }, method: 'GET', query: {} },
    response,
  );
  return response;
}

describe('exportação de candidaturas sem índice composto', () => {
  beforeEach(() => jest.clearAllMocks());

  test('exporta normalmente quando o índice existe', async () => {
    installFirestore();

    const response = await get();

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
  });

  test('não devolve 500 quando o índice composto falta', async () => {
    installFirestore({ indexMissing: true });

    const response = await get();

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.status).not.toHaveBeenCalledWith(500);
  });

  test('o recurso a memória mantém a ordenação por data descendente', async () => {
    installFirestore({ indexMissing: true });

    const response = await get();

    const csv = response.send.mock.calls[0][0] as string;
    const linhas = csv.split('\n');
    // Alfa é de março e Bravo de fevereiro: o mais recente vem primeiro.
    expect(linhas[1]).toContain('Alfa');
    expect(linhas[2]).toContain('Bravo');
  });

  test('regista o recurso a memória para o índice em falta não passar despercebido', async () => {
    installFirestore({ indexMissing: true });

    await get();

    expect(mockedWarning).toHaveBeenCalledWith(
      'export_applications.missing_index_fallback',
      expect.anything(),
    );
  });

  test('um erro que não seja de índice continua a devolver 500', async () => {
    const base = installFirestore();
    base.orderBy.mockReturnValue({
      get: jest.fn().mockRejectedValue(new Error('falha genérica')),
    });

    const response = await get();

    expect(response.status).toHaveBeenCalledWith(500);
  });
});
