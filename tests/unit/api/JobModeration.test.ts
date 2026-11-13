import { sendEmail } from '../../../lib/email';
import { admin } from '../../../lib/firebaseAdmin';
import { logServerWarning } from '../../../lib/serverLog';
import { createServerNotification } from '../../../lib/serverNotifications';
import moderateJobHandler from '../../../pages/api/admin/jobs/[id]/moderate';
import moderationSettingsHandler from '../../../pages/api/admin/moderation-settings';
import jobsHandler from '../../../pages/api/jobs/index';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
    Timestamp: {
      fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
      now: jest.fn(() => ({ toDate: () => new Date('2026-08-01T12:00:00Z') })),
    },
  });

  return {
    admin: {
      auth: jest.fn(),
      firestore,
    },
  };
});

jest.mock('../../../lib/empresaPlanFeatures', () => ({
  canCreateJob: jest.fn().mockResolvedValue({ allowed: true }),
  canHighlightJob: jest.fn().mockResolvedValue({ allowed: true }),
  getEmpresaPlanSummary: jest.fn(() => ({
    isActive: true,
    planId: 'basic_empresa',
    planName: 'Básico',
  })),
  getJobExpirationDate: jest.fn(() => new Date('2099-01-01T00:00:00Z')),
}));

jest.mock('../../../lib/email', () => ({
  isEmailConfigured: jest.fn(() => true),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  sendPushToUser: jest.fn(),
}));

// A criação de vagas tem um caminho só: avaliação (qualidade/risco/moderação)
// e gravação transacional. Aqui controla-se a decisão e captura-se a escrita.
const mockEvaluate = jest.fn();
const mockPersist = jest.fn();
jest.mock('../../../domain/jobs/submission', () => ({
  evaluateJobSubmission: (input: unknown) => mockEvaluate(input),
}));
jest.mock(
  '../../../infrastructure/firebase/jobs/FirestoreJobPublisher',
  () => ({
    jobIdFor: () => 'job-1',
    persistJob: (...args: unknown[]) => mockPersist(...args),
  }),
);
jest.mock('../../../lib/newJobBroadcast', () => ({
  broadcastNewJob: jest.fn().mockResolvedValue(undefined),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const mockedNotification = jest.mocked(createServerNotification);
const mockedSendEmail = jest.mocked(sendEmail);
const mockedWarning = jest.mocked(logServerWarning);

function createResponse() {
  const response = {
    json: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

describe('criacao de vaga com moderacao', () => {
  const notificationAdd = jest.fn();
  let moderationDoc: { exists: boolean; data?: () => Record<string, unknown> };
  let moderationGet: jest.Mock;

  function decision(kind: 'PUBLISH' | 'REVIEW') {
    return {
      decision: kind === 'REVIEW' ? { kind, reasons: ['PLATFORM'] } : { kind },
      quality: { score: 90, missing: [] },
      risk: { score: 0, signals: [] },
      expand: { fields: {}, review: [] },
      protectedTerms: [],
    };
  }

  function installCompanyFirestore() {
    moderationGet = jest.fn(async () => moderationDoc);
    const collection = jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: () => ({
                currentPlan: 'basic_empresa',
                name: 'Empresa QA',
                userType: 'empresa',
              }),
              exists: true,
              ref: { update: jest.fn() },
            }),
          })),
          where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              docs: [{ id: 'admin-1' }],
            }),
          })),
        };
      }
      if (name === 'jobs') {
        return {
          where: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ docs: [] }),
            })),
          })),
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              id: 'job-1',
              data: () => ({ status: 'active' }),
            }),
          })),
        };
      }
      if (name === 'settings') {
        return { doc: jest.fn(() => ({ get: moderationGet })) };
      }
      if (name === 'notifications') {
        return { add: notificationAdd.mockResolvedValue({ id: 'n-1' }) };
      }
      throw new Error(`Colecao inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({ collection });
  }

  function jobRequestBody() {
    return {
      dataFecho: '2098-12-31',
      descricao: 'Descrição da vaga',
      localizacao: 'São Tomé',
      tipoContrato: 'full-time',
      titulo: '[QA] Vaga Teste',
    };
  }

  async function createJob(overrides: Record<string, unknown> = {}) {
    const response = createResponse();
    await jobsHandler(
      {
        body: { ...jobRequestBody(), ...overrides },
        headers: { authorization: 'Bearer valid' },
        method: 'POST',
      },
      response,
    );
    return response;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    moderationDoc = { exists: false };
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'company-1' }),
    });
    installCompanyFirestore();
  });

  test('com moderacao ligada a vaga vai para revisao e os admins sao avisados', async () => {
    moderationDoc = {
      data: () => ({ jobApprovalRequired: true }),
      exists: true,
    };
    mockEvaluate.mockReturnValue(decision('REVIEW'));
    mockPersist.mockResolvedValue({
      kind: 'CREATED',
      jobId: 'job-1',
      status: 'PENDING_REVIEW',
    });

    const response = await createJob();

    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({ platformModerationForced: true }),
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json.mock.calls[0][0].message).toBe(
      'A sua vaga está em revisão. Normalmente demora até 1 dia útil.',
    );
    expect(notificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedId: 'job-1',
        type: 'JOB_REVIEW',
        userId: 'admin-1',
      }),
    );
  });

  test('sem doc de settings a vaga e publicada diretamente', async () => {
    mockEvaluate.mockReturnValue(decision('PUBLISH'));
    mockPersist.mockResolvedValue({
      kind: 'CREATED',
      jobId: 'job-1',
      status: 'PUBLISHED',
    });

    const response = await createJob();

    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({ platformModerationForced: false }),
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json.mock.calls[0][0].message).toBe(
      'Vaga criada com sucesso',
    );
    expect(notificationAdd).not.toHaveBeenCalled();
  });

  test('a criação mantém a vaga aberta até ao fim do dia de fecho em São Tomé', async () => {
    mockEvaluate.mockReturnValue(decision('PUBLISH'));
    mockPersist.mockResolvedValue({
      kind: 'CREATED',
      jobId: 'job-1',
      status: 'PUBLISHED',
    });
    expect((await createJob()).status).toHaveBeenCalledWith(201);
    const payload = mockPersist.mock.calls[0]?.[1].payload;
    expect(payload.dataFecho).toBe('2098-12-31');
    expect(payload.expiresAt.toDate().toISOString()).toBe(
      '2098-12-31T23:59:59.999Z',
    );
  });

  test('a criação recusa datas impossíveis antes de avaliar ou gravar a vaga', async () => {
    const result = await createJob({ dataFecho: '2027-02-31' });
    expect(result.status).toHaveBeenCalledWith(400);
    expect(mockEvaluate).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
  });

  test('falha na leitura das settings nao forca a moderacao e regista aviso', async () => {
    moderationGet.mockRejectedValue(new Error('firestore indisponivel'));
    mockEvaluate.mockReturnValue(decision('PUBLISH'));
    mockPersist.mockResolvedValue({
      kind: 'CREATED',
      jobId: 'job-1',
      status: 'PUBLISHED',
    });

    const response = await createJob();

    expect(response.status).toHaveBeenCalledWith(201);
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({ platformModerationForced: false }),
    );
    expect(mockedWarning).toHaveBeenCalledWith(
      'jobs.moderation_settings_lookup_failed',
      expect.anything(),
    );
  });
});

describe('decisao de moderacao pelo admin', () => {
  const transaction = {
    get: jest.fn(),
    update: jest.fn(),
  };
  const activitiesAdd = jest.fn().mockResolvedValue({ id: 'act-1' });
  const jobRef = { id: 'job-1' };
  let jobData: Record<string, unknown>;

  function installAdminFirestore({ actingUserType = 'admin' } = {}) {
    transaction.get.mockImplementation(async () => ({
      data: () => jobData,
      exists: true,
      ref: jobRef,
    }));
    const runTransaction = jest.fn(async (callback) => callback(transaction));
    const collection = jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn((uid: string) => ({
            get: jest.fn().mockResolvedValue({
              data: () =>
                uid === 'admin-1'
                  ? { userType: actingUserType }
                  : {
                      email: 'empresa@example.test',
                      name: 'Empresa QA',
                      userType: 'empresa',
                    },
              exists: true,
            }),
          })),
        };
      }
      if (name === 'jobs') {
        return { doc: jest.fn(() => jobRef) };
      }
      if (name === 'activities') {
        return { add: activitiesAdd };
      }
      throw new Error(`Colecao inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({ collection, runTransaction });
    return { runTransaction };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jobData = {
      companyId: 'company-1',
      dataFecho: '2098-12-31',
      status: 'pending_review',
      titulo: '[QA] Vaga Teste',
    };
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
  });

  async function postModeration(body: Record<string, unknown>) {
    const response = createResponse();
    await moderateJobHandler(
      {
        body,
        headers: { authorization: 'Bearer valid' },
        method: 'POST',
        query: { id: 'job-1' },
      },
      response,
    );
    return response;
  }

  test('aprovacao publica a vaga e notifica a empresa por push e email', async () => {
    installAdminFirestore();

    const response = await postModeration({ action: 'approve' });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(transaction.update).toHaveBeenCalledWith(
      jobRef,
      expect.objectContaining({
        moderatedBy: 'admin-1',
        moderationDecision: 'approved',
        status: 'active',
      }),
    );
    expect(mockedNotification).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        userId: 'company-1',
      }),
    );
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'empresa@example.test' }),
    );
    expect(activitiesAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'job_approved' }),
    );
  });

  test('rejeicao persiste o motivo e envia-o na notificacao', async () => {
    installAdminFirestore();

    const response = await postModeration({
      action: 'reject',
      reason: 'Conteúdo incompleto',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(transaction.update).toHaveBeenCalledWith(
      jobRef,
      expect.objectContaining({
        moderationDecision: 'rejected',
        moderationReason: 'Conteúdo incompleto',
        status: 'rejected',
      }),
    );
    const notificationPayload = mockedNotification.mock.calls[0]?.[1] as
      { message?: string } | undefined;
    expect(notificationPayload?.message).toContain('Conteúdo incompleto');
    expect(activitiesAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'job_rejected' }),
    );
  });

  test('vaga ja processada devolve 409 sem escrita', async () => {
    installAdminFirestore();
    jobData = { ...jobData, status: 'active' };

    const response = await postModeration({ action: 'approve' });

    expect(response.status).toHaveBeenCalledWith(409);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(mockedNotification).not.toHaveBeenCalled();
  });

  test('vaga pendente ja expirada nao pode ser aprovada', async () => {
    installAdminFirestore();
    jobData = { ...jobData, dataFecho: '2020-01-01' };

    const response = await postModeration({ action: 'approve' });

    expect(response.status).toHaveBeenCalledWith(409);
    expect(transaction.update).not.toHaveBeenCalled();
  });

  test('nao-admin recebe 403 e acao invalida recebe 400', async () => {
    installAdminFirestore({ actingUserType: 'empresa' });
    const forbidden = await postModeration({ action: 'approve' });
    expect(forbidden.status).toHaveBeenCalledWith(403);

    installAdminFirestore();
    const invalid = await postModeration({ action: 'delete' });
    expect(invalid.status).toHaveBeenCalledWith(400);
  });

  test('falha do email nao falha a decisao', async () => {
    installAdminFirestore();
    mockedSendEmail.mockRejectedValueOnce(new Error('smtp caiu'));

    const response = await postModeration({ action: 'approve' });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(mockedWarning).toHaveBeenCalledWith(
      'jobs.moderation_email_failed',
      expect.anything(),
    );
  });

  test('metodo GET recebe 405', async () => {
    installAdminFirestore();
    const response = createResponse();
    await moderateJobHandler(
      {
        body: {},
        headers: { authorization: 'Bearer valid' },
        method: 'GET',
        query: { id: 'job-1' },
      },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(405);
  });
});

describe('toggle de moderacao nas settings', () => {
  const settingsSet = jest.fn().mockResolvedValue(undefined);
  const activitiesAdd = jest.fn().mockResolvedValue({ id: 'act-1' });
  let settingsDoc: { exists: boolean; data?: () => Record<string, unknown> };

  function installSettingsFirestore({ actingUserType = 'admin' } = {}) {
    const collection = jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              data: () => ({ userType: actingUserType }),
              exists: true,
            }),
          })),
        };
      }
      if (name === 'settings') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => settingsDoc),
            set: settingsSet,
          })),
        };
      }
      if (name === 'activities') {
        return { add: activitiesAdd };
      }
      throw new Error(`Colecao inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({ collection });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    settingsDoc = { exists: false };
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
  });

  test('GET devolve o default desligado', async () => {
    installSettingsFirestore();
    const response = createResponse();
    await moderationSettingsHandler(
      {
        body: {},
        headers: { authorization: 'Bearer valid' },
        method: 'GET',
      },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      jobApprovalRequired: false,
    });
  });

  test('PUT exige booleano e grava com auditoria', async () => {
    installSettingsFirestore();
    const invalid = createResponse();
    await moderationSettingsHandler(
      {
        body: { jobApprovalRequired: 'sim' },
        headers: { authorization: 'Bearer valid' },
        method: 'PUT',
      },
      invalid,
    );
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(settingsSet).not.toHaveBeenCalled();

    const response = createResponse();
    await moderationSettingsHandler(
      {
        body: { jobApprovalRequired: true },
        headers: { authorization: 'Bearer valid' },
        method: 'PUT',
      },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(settingsSet).toHaveBeenCalledWith(
      expect.objectContaining({ jobApprovalRequired: true }),
      { merge: true },
    );
    expect(activitiesAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'moderation_settings_updated' }),
    );
  });

  test('nao-admin recebe 403', async () => {
    installSettingsFirestore({ actingUserType: 'empresa' });
    const response = createResponse();
    await moderationSettingsHandler(
      {
        body: { jobApprovalRequired: true },
        headers: { authorization: 'Bearer valid' },
        method: 'PUT',
      },
      response,
    );
    expect(response.status).toHaveBeenCalledWith(403);
    expect(settingsSet).not.toHaveBeenCalled();
  });
});
