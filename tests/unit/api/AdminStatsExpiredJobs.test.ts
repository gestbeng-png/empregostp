import { admin } from '../../../lib/firebaseAdmin';
import adminStatsHandler from '../../../pages/api/admin';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

const PASSADO = '2020-01-01T00:00:00.000Z';
const FUTURO = '2099-12-31T23:59:59.000Z';

function install(jobs: Record<string, unknown>[]) {
  const snap = (docs: Record<string, unknown>[]) => ({
    docs: docs.map((d, i) => ({ data: () => d, id: `d${i}` })),
    size: docs.length,
  });

  const collection = jest.fn((name: string) => {
    const base = {
      get: jest.fn().mockResolvedValue(
        name === 'jobs' ? snap(jobs) : snap([{}, {}]),
      ),
      where: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(snap([{}, {}])),
      })),
    };
    if (name === 'users') {
      return {
        ...base,
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => ({ userType: 'admin' }),
            exists: true,
          }),
        })),
      };
    }
    return base;
  });

  firestoreMock.mockReturnValue({ collection });
}

async function pedirEstatisticas() {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
  });
  const response = createResponse();
  await adminStatsHandler(
    {
      headers: { authorization: 'Bearer valido' },
      method: 'GET',
      query: {},
    } as never,
    response as never,
  );
  return response;
}

describe('estatísticas do admin refletem a expiração das vagas', () => {
  beforeEach(() => jest.clearAllMocks());

  test('vaga com prazo ultrapassado não conta como activa', async () => {
    install([
      { dataFecho: FUTURO, status: 'active' },
      { dataFecho: PASSADO, status: 'active' }, // expirada, mas ainda "active"
      { dataFecho: PASSADO, status: 'active' },
    ]);

    const response = await pedirEstatisticas();
    const { stats } = response.json.mock.calls[0][0];

    expect(stats.activeJobs).toBe(1);
    expect(stats.closedJobs).toBe(2);
    expect(stats.totalJobs).toBe(3);
  });

  test('vagas dentro do prazo continuam a contar como activas', async () => {
    install([
      { dataFecho: FUTURO, status: 'active' },
      { dataFecho: FUTURO, status: 'active' },
    ]);

    const response = await pedirEstatisticas();
    const { stats } = response.json.mock.calls[0][0];

    expect(stats.activeJobs).toBe(2);
    expect(stats.closedJobs).toBe(0);
  });
});
