import { admin } from '../../../lib/firebaseAdmin';
import jobHandler from '../../../pages/api/jobs/[id]';

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

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function install({ candidaturas = 3 }: { candidaturas?: number } = {}) {
  const jobDelete = jest.fn().mockResolvedValue(undefined);
  const batchDelete = jest.fn();
  const batchCommit = jest.fn().mockResolvedValue(undefined);
  const savedDelete = jest.fn();

  const jobRef = {
    delete: jobDelete,
    get: jest.fn().mockResolvedValue({
      data: () => ({ companyId: 'empresa-1', status: 'active', titulo: 'Vaga' }),
      exists: true,
      id: 'vaga-1',
    }),
    id: 'vaga-1',
  };

  const applicationDocs = Array.from({ length: candidaturas }, (_, i) => ({
    id: `cand-${i + 1}`,
    ref: { id: `cand-${i + 1}` },
  }));

  const collection = jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => ({ userType: 'empresa' }),
            exists: true,
          }),
        })),
      };
    }
    if (name === 'jobs') return { doc: jest.fn(() => jobRef) };
    if (name === 'applications') {
      return {
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: applicationDocs,
            empty: applicationDocs.length === 0,
            size: applicationDocs.length,
          }),
        })),
      };
    }
    if (name === 'savedJobs') {
      return {
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: [{ id: 's-1', ref: { id: 's-1' } }],
            empty: false,
            size: 1,
          }),
        })),
      };
    }
    throw new Error(`Colecao inesperada: ${name}`);
  });

  firestoreMock.mockReturnValue({
    batch: jest.fn(() => ({ commit: batchCommit, delete: batchDelete })),
    collection,
  });

  return { batchCommit, batchDelete, jobDelete, savedDelete };
}

async function apagar() {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'empresa-1' }),
  });
  const response = createResponse();
  await jobHandler(
    {
      body: {},
      headers: { authorization: 'Bearer valido' },
      method: 'DELETE',
      query: { id: 'vaga-1' },
    } as never,
    response as never,
  );
  return response;
}

describe('eliminar uma vaga não deixa registos órfãos', () => {
  beforeEach(() => jest.clearAllMocks());

  test('apaga também as candidaturas associadas', async () => {
    const { batchCommit, batchDelete, jobDelete } = install({ candidaturas: 3 });

    const response = await apagar();

    expect(response.status).toHaveBeenCalledWith(200);
    expect(jobDelete).toHaveBeenCalled();
    // 3 candidaturas + 1 vaga guardada
    expect(batchDelete).toHaveBeenCalledTimes(4);
    expect(batchCommit).toHaveBeenCalled();
  });

  test('vaga sem candidaturas continua a poder ser eliminada', async () => {
    const { jobDelete } = install({ candidaturas: 0 });

    const response = await apagar();

    expect(response.status).toHaveBeenCalledWith(200);
    expect(jobDelete).toHaveBeenCalled();
  });
});
