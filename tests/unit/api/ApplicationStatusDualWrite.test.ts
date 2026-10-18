import { admin } from '../../../lib/firebaseAdmin';
import applicationStatusHandler from '../../../pages/api/applications/[id]/status';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));
jest.mock('firebase-admin', () => ({
  firestore: {
    FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
    Timestamp: { now: jest.fn(() => 'now-ts') },
  },
}));
jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue(undefined),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  response.json.mockReturnValue(response);
  response.setHeader.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function configure(application: Record<string, unknown>) {
  const data = {
    candidateId: 'cand-1',
    candidateUserId: 'cand-1',
    companyId: 'company-1',
    organizationId: 'company-1',
    jobId: 'job-1',
    jobTitle: 'Motorista',
    status: 'pending',
    timeline: [],
    source: 'whatsapp',
    ...application,
  };
  const update = jest.fn();
  const create = jest.fn();
  const set = jest.fn();
  const transaction = {
    get: jest.fn().mockResolvedValue({ exists: true, data: () => data }),
    update,
    create,
    set,
  };
  let counter = 0;
  const collection = jest.fn((name: string) => {
    if (name === 'users')
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ userType: 'empresa', name: 'Transportes X' }),
          }),
        })),
      };
    if (name === 'applications')
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: true, data: () => data }),
        })),
      };
    if (name === 'jobs')
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ companyId: 'company-1' }),
          }),
        })),
      };
    if (name === 'activities')
      return { add: jest.fn().mockResolvedValue(undefined) };
    return {
      doc: jest.fn((id?: string) => ({ id: id ?? `${name}-${++counter}` })),
    };
  });
  firestoreMock.mockReturnValue({
    collection,
    runTransaction: jest.fn(async (callback) => callback(transaction)),
  });
  return { update, create, set };
}

const request = (status: string) => ({
  method: 'PATCH',
  headers: { authorization: 'Bearer t' },
  query: { id: 'app-1' },
  body: { status },
});

describe('D7 — ATS atual escreve também o estado v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'company-1' }),
    });
  });

  test('legado sem v2Status: só o estado legado (comportamento anterior)', async () => {
    const { update, create } = configure({});
    const response = createResponse();
    await applicationStatusHandler(request('analysis'), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ v2Status: expect.anything() }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  test('«Em análise» numa candidatura v2: UNDER_REVIEW, versão, histórico, outbox, 1.ª leitura', async () => {
    const { update, create } = configure({ v2Status: 'SUBMITTED', version: 1 });
    const response = createResponse();
    await applicationStatusHandler(request('analysis'), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'analysis',
        v2Status: 'UNDER_REVIEW',
        version: 2,
        firstViewedAt: 'now-ts',
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^applicationsStatusHistory-/),
      }),
      expect.objectContaining({
        from: 'SUBMITTED',
        to: 'UNDER_REVIEW',
        actorType: 'EMPLOYER',
        version: 2,
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^outboxEvents-/) }),
      expect.objectContaining({
        payload: { entityId: 'app-1', entityKind: 'Application', version: 2 },
      }),
    );
  });

  test('«Aprovada» cria contratação direta (E5.5) com a origem da candidatura', async () => {
    const { update, set } = configure({
      v2Status: 'UNDER_REVIEW',
      version: 2,
      status: 'analysis',
    });
    await applicationStatusHandler(request('approved'), createResponse());
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'approved',
        v2Status: 'HIRED',
        version: 4,
      }),
    );
    expect(set).toHaveBeenCalledWith(
      { id: 'app-1' },
      expect.objectContaining({
        source: 'DIRECT_MARK',
        attributionSource: 'whatsapp',
        candidateConfirmation: 'PENDING',
        candidateUserId: 'cand-1',
        status: 'ACTIVE',
      }),
    );
  });

  test('«Rejeitada»: REJECTED com motivo NOT_SELECTED', async () => {
    const { update } = configure({
      v2Status: 'INTERVIEW',
      version: 3,
      status: 'interview',
    });
    await applicationStatusHandler(request('rejected'), createResponse());
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        v2Status: 'REJECTED',
        closedReason: 'NOT_SELECTED',
        version: 4,
      }),
    );
  });

  test('voltar a «pendente» depois de lida é recusado sem escrita', async () => {
    const { update } = configure({
      v2Status: 'UNDER_REVIEW',
      version: 2,
      status: 'analysis',
    });
    const response = createResponse();
    await applicationStatusHandler(request('pending'), response);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(update).not.toHaveBeenCalled();
  });
});
