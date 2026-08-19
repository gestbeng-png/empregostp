import { admin } from '../../../lib/firebaseAdmin';
import notifyHandler from '../../../pages/api/notify-candidates';

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

jest.mock('../../../lib/serverNotifications', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

const FUTURO = '2099-12-31T23:59:59.000Z';
const PASSADO = '2020-01-01T00:00:00.000Z';

/**
 * Um candidato Premium activo, que é quem pode receber estas notificações.
 * Os sinais (área, localização e competências) existem para o matching de
 * `shouldNotifyCandidateForJob` atingir o mínimo de 28 pontos — sem eles o
 * caso positivo não notificaria ninguém e o teste passaria por vazio.
 */
const candidatoPremium = {
  currentPlan: 'unlimited_candidato',
  localizacao: 'São Tomé',
  name: 'Candidata QA',
  objectiveArea: 'Gestão e Administração',
  planEndDate: null,
  profession: 'Gestor de Projetos',
  skills: ['Gestão', 'Projetos', 'Organização'],
  userType: 'candidato',
};

function installFirestore({ job }: { job: Record<string, unknown> | null }) {
  const batchSet = jest.fn();
  const batchCommit = jest.fn().mockResolvedValue(undefined);
  const notificationsDoc = jest.fn(() => ({ id: 'notif-1' }));

  const collection = jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            data: () => ({ name: 'Empresa QA', userType: 'empresa' }),
            exists: true,
          }),
        })),
        where: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              docs: [{ data: () => candidatoPremium, id: 'candidato-1' }],
            }),
          })),
        })),
      };
    }
    if (name === 'jobs') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(
            job
              ? { data: () => job, exists: true, id: 'vaga-1' }
              : { exists: false },
          ),
        })),
      };
    }
    if (name === 'profiles') return { doc: jest.fn((id: string) => ({ id })) };
    if (name === 'notifications') return { doc: notificationsDoc };
    throw new Error(`Colecao inesperada: ${name}`);
  });

  firestoreMock.mockReturnValue({
    batch: jest.fn(() => ({ commit: batchCommit, set: batchSet })),
    collection,
    getAll: jest.fn().mockResolvedValue([
      {
        data: () => ({
          city: 'São Tomé',
          objectiveArea: 'Gestão e Administração',
          skillsHard: ['Gestão', 'Projetos', 'Organização'],
          title: 'Gestor de Projetos',
        }),
        exists: true,
        id: 'candidato-1',
      },
    ]),
  });

  return { batchCommit, batchSet };
}

async function notificar(body: Record<string, unknown>) {
  authMock.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'empresa-1' }),
  });
  const response = createResponse();
  await notifyHandler(
    {
      body,
      headers: { authorization: 'Bearer valido' },
      method: 'POST',
    } as never,
    response as never,
  );
  return response;
}

const CORPO_ATACANTE = {
  jobId: 'vaga-1',
  jobLocation: '[FORJADO] Local inventado',
  jobTitle: '[FORJADO] Titulo inventado pelo atacante',
};

describe('notificação de candidatos exige vaga própria, existente e activa', () => {
  beforeEach(() => jest.clearAllMocks());

  test('vaga inexistente é recusada e nada é escrito', async () => {
    const { batchCommit, batchSet } = installFirestore({ job: null });

    const response = await notificar(CORPO_ATACANTE);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(batchSet).not.toHaveBeenCalled();
    expect(batchCommit).not.toHaveBeenCalled();
  });

  test('vaga de outra empresa é recusada', async () => {
    const { batchCommit, batchSet } = installFirestore({
      job: {
        companyId: 'OUTRA-empresa',
        dataFecho: FUTURO,
        localizacao: 'São Tomé',
        status: 'active',
        titulo: 'Vaga alheia',
      },
    });

    const response = await notificar(CORPO_ATACANTE);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(batchSet).not.toHaveBeenCalled();
    expect(batchCommit).not.toHaveBeenCalled();
  });

  test('vaga por moderar (pending_review) não pode ser divulgada', async () => {
    const { batchSet } = installFirestore({
      job: {
        companyId: 'empresa-1',
        dataFecho: FUTURO,
        localizacao: 'São Tomé',
        status: 'pending_review',
        titulo: 'Vaga por aprovar',
      },
    });

    const response = await notificar(CORPO_ATACANTE);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(batchSet).not.toHaveBeenCalled();
  });

  test('vaga expirada não pode ser divulgada', async () => {
    const { batchSet } = installFirestore({
      job: {
        companyId: 'empresa-1',
        dataFecho: PASSADO,
        localizacao: 'São Tomé',
        status: 'active',
        titulo: 'Vaga expirada',
      },
    });

    const response = await notificar(CORPO_ATACANTE);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(batchSet).not.toHaveBeenCalled();
  });

  test('vaga válida notifica, mas com o conteúdo GUARDADO e não o do pedido', async () => {
    const { batchCommit, batchSet } = installFirestore({
      job: {
        companyId: 'empresa-1',
        dataFecho: FUTURO,
        localizacao: 'São Tomé',
        status: 'active',
        titulo: 'Gestor de Projetos',
      },
    });

    const response = await notificar(CORPO_ATACANTE);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(batchSet).toHaveBeenCalled();

    // O texto entregue ao candidato não pode vir do corpo do pedido.
    const gravado = JSON.stringify(batchSet.mock.calls);
    expect(gravado).not.toContain('[FORJADO]');
    expect(gravado).toContain('Gestor de Projetos');
  });
});
