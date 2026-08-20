import { admin } from '../../../lib/firebaseAdmin';
import { projectPublicJob } from '../../../lib/publicJob';
import adminJobHandler from '../../../pages/api/admin/jobs/[id]';

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

function install() {
  const update = jest.fn().mockResolvedValue(undefined);
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
    if (name === 'jobs') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => ({
              companyId: 'empresa-1',
              dataFecho: '2030-01-01',
              status: 'active',
              titulo: 'Vaga',
            }),
            exists: true,
          }),
          update,
        })),
      };
    }
    if (name === 'activities') {
      return { add: jest.fn().mockResolvedValue({ id: 'a-1' }) };
    }
    throw new Error(`Colecao inesperada: ${name}`);
  });
  firestoreMock.mockReturnValue({ collection });
  return { update };
}

async function editar(body: Record<string, unknown>) {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
  });
  const response = createResponse();
  await adminJobHandler(
    {
      body,
      headers: { authorization: 'Bearer valido' },
      method: 'PUT',
      query: { id: 'vaga-1' },
    } as never,
    response as never,
  );
  return response;
}

describe('o editor admin escreve no esquema que a página pública lê', () => {
  beforeEach(() => jest.clearAllMocks());

  test('persiste os campos canónicos de salário, localização e prazo', async () => {
    const { update } = install();

    const response = await editar({
      dataFecho: '2031-06-30',
      descricao: 'Descrição',
      localizacao: 'São Tomé',
      salarioAte: 18000,
      salarioDe: 12000,
      status: 'active',
      titulo: 'Vaga',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    const gravado = update.mock.calls[0][0];
    expect(gravado.salarioDe).toBe(12000);
    expect(gravado.salarioAte).toBe(18000);
    expect(gravado.localizacao).toBe('São Tomé');
    expect(gravado.dataFecho).toBe('2031-06-30');
  });

  test('o que o admin grava é mesmo o que a página pública mostra', async () => {
    const { update } = install();

    await editar({
      dataFecho: '2031-06-30',
      descricao: 'Descrição',
      localizacao: 'São Tomé',
      salarioAte: 18000,
      salarioDe: 12000,
      status: 'active',
      titulo: 'Vaga',
    });

    // O ponto do achado: antes, o valor gravado nunca chegava ao público.
    const publico = projectPublicJob({ id: 'vaga-1', ...update.mock.calls[0][0] });
    expect(String(publico.salarioDe)).toBe('12000');
    expect(String(publico.salarioAte)).toBe('18000');
    expect(publico.localizacao).toBe('São Tomé');
    expect(String(publico.dataFecho)).toContain('2031-06-30');
  });

  test('já não grava os campos legados que ninguém lê', async () => {
    const { update } = install();

    await editar({
      descricao: 'Descrição',
      location: 'Legado',
      prazo: '2029-01-01',
      salario: '99999',
      status: 'active',
      titulo: 'Vaga',
    });

    const gravado = update.mock.calls[0][0];
    expect(gravado).not.toHaveProperty('salario');
    expect(gravado).not.toHaveProperty('location');
    expect(gravado).not.toHaveProperty('prazo');
  });

  test('título, descrição e estado continuam a funcionar', async () => {
    const { update } = install();

    const response = await editar({
      descricao: 'Nova descrição',
      status: 'closed',
      titulo: 'Novo título',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    const gravado = update.mock.calls[0][0];
    expect(gravado.titulo).toBe('Novo título');
    expect(gravado.descricao).toBe('Nova descrição');
    expect(gravado.status).toBe('closed');
  });
});
