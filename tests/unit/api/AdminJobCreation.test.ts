import { admin } from '../../../lib/firebaseAdmin';
import adminJobsHandler from '../../../pages/api/admin/jobs';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
    Timestamp: {
      fromDate: jest.fn(() => 'expiration-timestamp'),
    },
  });

  return {
    __esModule: true,
    admin: {
      auth: jest.fn(),
      firestore,
    },
  };
});

jest.mock('../../../lib/jobExpiration', () => ({
  getEffectiveJobStatus: (job: { status?: string }) => job.status || 'active',
  parseJobCloseDate: (value: string) =>
    value ? new Date(`${value}T23:59:59.999Z`) : null,
  syncExpiredJobStatus: jest.fn(),
}));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;

function createResponse() {
  const response = {
    json: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function validJob(overrides = {}) {
  return {
    categoria: 'Gestão e Administração',
    companyId: '',
    companyName: 'Empresa Parceira STP',
    dataFecho: '2026-12-31',
    descricao: 'Descrição completa da oportunidade.',
    beneficios: 'Seguro de saúde e formação.',
    localizacao: 'São Tomé',
    requisitos: 'Licenciatura e três anos de experiência.',
    tdrFileName: 'termos-referencia.pdf',
    tdrUrl: 'https://files.example/tdr.pdf',
    tipoContrato: 'Tempo Integral',
    titulo: 'Técnico de Operações',
    salarioAte: '9000',
    salarioDe: '6000',
    ...overrides,
  };
}

describe('criação administrativa de vagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
  });

  test('publica para uma empresa não cadastrada sem criar ou exigir companyId', async () => {
    let persistedJob: Record<string, unknown> = {};
    const addJob = jest.fn(async (job) => {
      persistedJob = job;
      return {
        get: jest.fn().mockResolvedValue({
          data: () => persistedJob,
          id: 'job-external-1',
        }),
        id: 'job-external-1',
      };
    });
    const addActivity = jest.fn().mockResolvedValue(undefined);
    const userDoc = jest.fn(() => ({
      get: jest.fn().mockResolvedValue({
        data: () => ({ userType: 'admin' }),
        exists: true,
      }),
    }));
    const collection = jest.fn((name: string) => {
      if (name === 'users') return { doc: userDoc };
      if (name === 'jobs') return { add: addJob };
      if (name === 'activities') return { add: addActivity };
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({ collection });

    const response = createResponse();
    await adminJobsHandler(
      {
        body: validJob(),
        cookies: { token: 'valid-token' },
        headers: {},
        method: 'POST',
        query: {},
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(userDoc).toHaveBeenCalledTimes(1);
    expect(userDoc).toHaveBeenCalledWith('admin-1');
    expect(addJob).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: '',
        companyName: 'Empresa Parceira STP',
        companySource: 'external',
        beneficios: 'Seguro de saúde e formação.',
        empresa: 'Empresa Parceira STP',
        empresaNome: 'Empresa Parceira STP',
        isExternalCompany: true,
        requisitos: 'Licenciatura e três anos de experiência.',
        salarioAte: 9000,
        salarioDe: 6000,
        currency: 'STN',
        tdrFileName: 'termos-referencia.pdf',
        tdrUrl: 'https://files.example/tdr.pdf',
        titulo: 'Técnico de Operações',
      }),
    );
    expect(addActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: null,
        companyName: 'Empresa Parceira STP',
      }),
    );
  });

  test('continua a exigir uma empresa, por seleção ou por nome manual', async () => {
    const addJob = jest.fn();
    const collection = jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: () => ({ userType: 'admin' }),
              exists: true,
            }),
          })),
        };
      }
      if (name === 'jobs') return { add: addJob };
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({ collection });

    const response = createResponse();
    await adminJobsHandler(
      {
        body: validJob({ companyName: '   ' }),
        cookies: { token: 'valid-token' },
        headers: {},
        method: 'POST',
        query: {},
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(addJob).not.toHaveBeenCalled();
  });

  test('rejeita um intervalo salarial invertido antes de persistir a vaga', async () => {
    const addJob = jest.fn();
    const collection = jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: () => ({ userType: 'admin' }),
              exists: true,
            }),
          })),
        };
      }
      if (name === 'jobs') return { add: addJob };
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({ collection });

    const response = createResponse();
    await adminJobsHandler(
      {
        body: validJob({ salarioAte: '6000', salarioDe: '9000' }),
        cookies: { token: 'valid-token' },
        headers: {},
        method: 'POST',
        query: {},
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: 'O salário máximo não pode ser inferior ao salário mínimo',
    });
    expect(addJob).not.toHaveBeenCalled();
  });
});
