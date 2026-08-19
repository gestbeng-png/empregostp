import { admin } from '../../../lib/firebaseAdmin';
import adminJobHandler from '../../../pages/api/admin/jobs/[id]';

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

function installFirestore({ jobStatus }: { jobStatus: string }) {
  const update = jest.fn().mockResolvedValue(undefined);
  const activitiesAdd = jest.fn().mockResolvedValue({ id: 'a-1' });

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
              status: jobStatus,
              titulo: 'Vaga em revisão',
            }),
            exists: true,
          }),
          update,
        })),
      };
    }
    if (name === 'activities') return { add: activitiesAdd };
    throw new Error(`Colecao inesperada: ${name}`);
  });

  firestoreMock.mockReturnValue({ collection });
  return { update };
}

async function editar(status: string) {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
  });
  const response = createResponse();
  await adminJobHandler(
    {
      body: { descricao: 'Descrição', status, titulo: 'Vaga em revisão' },
      headers: { authorization: 'Bearer valido' },
      method: 'PUT',
      query: { id: 'vaga-1' },
    } as never,
    response as never,
  );
  return response;
}

describe('o PUT genérico de vagas não pode contornar a moderação', () => {
  beforeEach(() => jest.clearAllMocks());

  test('vaga em pending_review não pode ser activada pelo PUT genérico', async () => {
    const { update } = installFirestore({ jobStatus: 'pending_review' });

    const response = await editar('active');

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'JOB_REQUIRES_MODERATION' }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  test('vaga em pending_review também não pode ser fechada por aqui', async () => {
    const { update } = installFirestore({ jobStatus: 'pending_review' });

    const response = await editar('closed');

    expect(response.status).toHaveBeenCalledWith(409);
    expect(update).not.toHaveBeenCalled();
  });

  test('vaga já publicada continua editável normalmente', async () => {
    const { update } = installFirestore({ jobStatus: 'active' });

    const response = await editar('closed');

    expect(response.status).toHaveBeenCalledWith(200);
    expect(update).toHaveBeenCalled();
  });
});
