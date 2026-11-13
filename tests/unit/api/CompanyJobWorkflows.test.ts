import { isAcceptingApplications } from '@/domain/jobs/deadlines';
import { readJobLifecycle } from '@/domain/jobs/legacyView';
import { admin } from '@/lib/firebaseAdmin';
import applicationStatusHandler from '@/pages/api/applications/[id]/status';
import jobHandler from '@/pages/api/jobs/[id]';
import highlightHandler from '@/pages/api/jobs/[id]/destaque';
import jobsHandler from '@/pages/api/jobs/index';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('@/lib/firebaseAdmin', () => {
  const { Timestamp } = jest.requireActual('firebase-admin/firestore');
  return {
    admin: {
      auth: jest.fn(),
      firestore: Object.assign(jest.fn(), {
        Timestamp,
        FieldValue: { serverTimestamp: () => new Date() },
      }),
    },
  };
});
jest.mock('@/lib/empresaPlanFeatures', () => ({
  canCreateJob: jest.fn().mockResolvedValue({ allowed: true }),
  canHighlightJob: jest.fn().mockResolvedValue({ allowed: true }),
  getEmpresaPlanSummary: () => ({ planId: 'basic_empresa' }),
  getJobExpirationDate: () => new Date('2026-11-30T12:00:00Z'),
}));
jest.mock('@/lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));
jest.mock('@/lib/newJobBroadcast', () => ({ broadcastNewJob: jest.fn() }));
jest.mock('@/lib/serverNotifications', () => ({
  createServerNotification: jest.fn(),
}));

const NOW = new Date('2026-10-22T12:00:00Z');
const verifyIdToken = jest.fn();
const job = {
  companyId: 'company-1',
  organizationId: 'company-1',
  titulo: 'Motorista',
  descricao: 'Distribuição de mercadorias.',
  localizacao: 'Água Grande',
  tipoContrato: 'full-time',
  vagasDisponiveis: 1,
  vacanciesCount: 1,
  dataFecho: '2026-10-30',
  applicationDeadline: new Date('2026-10-30T23:59:59.999Z'),
  expiresAt: new Date('2026-10-30T23:59:59.999Z'),
  status: 'active',
  v2Status: 'PUBLISHED',
  version: 1,
  currentVersionId: 'job-1_v1',
  createdAt: new Date('2026-10-01T10:00:00Z'),
};

function setup(
  overrides: Record<string, unknown> = {},
  user: Record<string, unknown> = {},
) {
  const fake = createFakeFirestore({
    'users/company-1': { userType: 'empresa', status: 'active', ...user },
    'jobs/job-1': { ...job, ...overrides },
    'jobVersions/job-1_v1': { snapshot: { titulo: job.titulo } },
  });
  jest.mocked(admin.firestore).mockReturnValue(fake.db);
  return fake;
}

function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.setHeader.mockReturnValue(res);
  return res;
}

async function callJob(method: string, body: Record<string, unknown>) {
  const res = response();
  await jobHandler(
    {
      method,
      body,
      query: { id: 'job-1' },
      headers: { authorization: 'Bearer token' },
    },
    res,
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW });
  verifyIdToken.mockResolvedValue({ uid: 'company-1' });
  jest.mocked(admin.auth).mockReturnValue({ verifyIdToken } as never);
});
afterEach(() => jest.useRealTimers());

describe('company job and application account guards', () => {
  test.each(['admin', 'candidato'])(
    '%s cannot publish through the company API',
    async (userType) => {
      const { docs } = setup({}, { userType });
      const before = [...docs.entries()];
      const res = response();
      await jobsHandler(
        {
          method: 'POST',
          headers: { authorization: 'Bearer token' },
          query: {},
          body: { titulo: 'Vaga de teste', companyId: 'company-1' },
        } as never,
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect([...docs.entries()]).toEqual(before);
    },
  );

  const routes = [
    ['jobs list', jobsHandler, 'GET'],
    ['jobs create', jobsHandler, 'POST'],
    ['job read', jobHandler, 'GET'],
    ['job edit', jobHandler, 'PUT'],
    ['job status', jobHandler, 'PATCH'],
    ['job delete', jobHandler, 'DELETE'],
    ['job highlight', highlightHandler, 'PATCH'],
    ['application status', applicationStatusHandler, 'PATCH'],
  ] as const;

  test.each(routes)(
    '%s rejects a suspended account before accessing business data',
    async (_name, handler, method) => {
      const { docs } = setup({}, { status: 'suspended' });
      const before = [...docs.entries()];
      const res = response();
      await handler(
        {
          method,
          headers: { authorization: 'Bearer token' },
          query: { id: 'job-1' },
          body: { status: 'analysis' },
        } as never,
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ACCOUNT_BLOCKED' }),
      );
      expect([...docs.entries()]).toEqual(before);
      expect(verifyIdToken).toHaveBeenCalledWith('token', true);
    },
  );

  test.each(routes)(
    '%s rejects a revoked token',
    async (_name, handler, method) => {
      const { docs } = setup();
      const before = [...docs.entries()];
      verifyIdToken.mockRejectedValue(new Error('auth/id-token-revoked'));
      const res = response();
      await handler(
        {
          method,
          headers: { authorization: 'Bearer token' },
          query: { id: 'job-1' },
          body: { status: 'analysis' },
        } as never,
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect([...docs.entries()]).toEqual(before);
    },
  );
});

describe('job status compatibility and moderation', () => {
  test.each([
    { status: 'pending_review', v2Status: 'PENDING_REVIEW' },
    { status: 'rejected', v2Status: 'REJECTED' },
    { status: 'disabled', v2Status: undefined },
    { status: 'pending_review', v2Status: undefined },
  ])('cannot publish a moderated job: %j', async (state) => {
    const { docs } = setup(state);
    const res = await callJob('PATCH', { status: 'active' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(docs.get('jobs/job-1')).toMatchObject({ status: state.status });
  });

  test('reactivation writes both statuses, a history entry and one outbox event', async () => {
    const { docs } = setup({
      status: 'inactive',
      v2Status: 'PAUSED',
      version: 4,
    });
    const res = await callJob('PATCH', { status: 'active' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(docs.get('jobs/job-1')).toMatchObject({
      status: 'active',
      v2Status: 'PUBLISHED',
      version: 5,
    });
    expect(
      [...docs.entries()].filter(([path]) =>
        path.startsWith('jobsStatusHistory/'),
      ),
    ).toEqual([
      [
        expect.any(String),
        expect.objectContaining({
          from: 'PAUSED',
          to: 'PUBLISHED',
          version: 5,
        }),
      ],
    ]);
    expect(
      [...docs.keys()].filter((path) => path.startsWith('outboxEvents/')),
    ).toHaveLength(1);
    await callJob('PATCH', { status: 'active' });
    expect(docs.get('jobs/job-1')?.version).toBe(5);
    expect(
      [...docs.keys()].filter((path) => path.startsWith('outboxEvents/')),
    ).toHaveLength(1);
  });

  test('closing uses the recruitment lifecycle and requires an explicit outcome', async () => {
    const { docs } = setup();
    expect(
      (await callJob('PATCH', { status: 'closed' })).status,
    ).toHaveBeenCalledWith(409);
    expect(docs.get('jobs/job-1')?.status).toBe('active');
    expect(
      (
        await callJob('PATCH', {
          status: 'closed',
          closeOutcome: 'POSITION_CANCELLED',
        })
      ).status,
    ).toHaveBeenCalledWith(200);
    expect(docs.get('jobs/job-1')).toMatchObject({
      status: 'closed',
      v2Status: 'CLOSED',
      version: 2,
      jobEndPending: true,
      jobEndState: 'CLOSED',
      closeOutcome: 'POSITION_CANCELLED',
    });
  });

  test('a finished recruitment cannot be silently reopened', async () => {
    const { docs } = setup({ status: 'closed', v2Status: 'CLOSED' });
    expect(
      (await callJob('PATCH', { status: 'active' })).status,
    ).toHaveBeenCalledWith(409);
    expect(docs.get('jobs/job-1')?.status).toBe('closed');
  });

  test('legacy closed jobs retain their reactivation action without creating a lifecycle', async () => {
    const { docs } = setup({ status: 'closed', v2Status: undefined });
    expect(
      (await callJob('PATCH', { status: 'active' })).status,
    ).toHaveBeenCalledWith(200);
    expect(docs.get('jobs/job-1')?.status).toBe('active');
    expect(docs.get('jobs/job-1')?.v2Status).toBeUndefined();
  });

  test.each(['DRAFT', undefined])(
    'a draft cannot bypass submission checks (%s)',
    async (v2Status) => {
      const { docs } = setup({ status: 'draft', v2Status });
      expect(
        (await callJob('PATCH', { status: 'active' })).status,
      ).toHaveBeenCalledWith(409);
      expect(docs.get('jobs/job-1')?.status).toBe('draft');
    },
  );
});

describe('editing canonical job data', () => {
  test('renewal updates the deadline used by submission, positions and required documents, preserving old snapshots', async () => {
    const { docs } = setup({
      dataFecho: '2026-10-20',
      applicationDeadline: new Date('2026-10-20T23:59:59.999Z'),
      expiresAt: new Date('2026-10-20T23:59:59.999Z'),
      status: 'closed',
      v2Status: 'EXPIRED',
      jobEndPending: true,
      jobEndState: 'EXPIRED',
      jobEndedAt: '2026-10-20T23:59:59.999Z',
    });
    const res = await callJob('PUT', {
      ...job,
      dataFecho: '2026-10-30',
      vagasDisponiveis: 3,
      requiredDocuments: {
        types: ['criminal_record', 'other'],
        otherLabel: 'Licença de condução',
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(docs.get('jobs/job-1')).toMatchObject({
      vagasDisponiveis: 3,
      vacanciesCount: 3,
      applicationDeadline: new Date('2026-10-30T23:59:59.999Z'),
      version: 2,
      currentVersionId: 'job-1_v2',
      v2Status: 'EXPIRED',
      requiredDocuments: {
        types: expect.arrayContaining(['criminal_record', 'other']),
        otherLabel: 'Licença de condução',
      },
    });
    expect(docs.get('jobVersions/job-1_v1')).toEqual({
      snapshot: { titulo: job.titulo },
    });
    expect(docs.get('jobVersions/job-1_v2')).toMatchObject({
      versionNumber: 2,
      snapshot: { vacanciesCount: 3, dataFecho: '2026-10-30' },
    });
    expect(
      (await callJob('PATCH', { status: 'active' })).status,
    ).toHaveBeenCalledWith(200);
    const saved = docs.get('jobs/job-1') ?? {};
    expect(saved).toMatchObject({
      v2Status: 'PUBLISHED',
      jobEndPending: false,
      jobEndState: null,
    });
    expect(isAcceptingApplications(readJobLifecycle(saved), NOW)).toBe(true);
  });

  test('the last day remains open after midnight and omitted document requirements are retained', async () => {
    const requirements = {
      types: ['cv', 'certificates', 'criminal_record'],
      otherLabel: '',
    };
    const { docs } = setup({ requiredDocuments: requirements });
    expect(
      (await callJob('PUT', { ...job, dataFecho: '2026-10-22' })).status,
    ).toHaveBeenCalledWith(200);
    const saved = docs.get('jobs/job-1') ?? {};
    expect(saved.requiredDocuments).toEqual(requirements);
    expect(isAcceptingApplications(readJobLifecycle(saved), NOW)).toBe(true);
    expect(
      isAcceptingApplications(
        readJobLifecycle(saved),
        new Date('2026-10-23T00:00:00Z'),
      ),
    ).toBe(false);
  });

  test('impossible dates are rejected without changing the job', async () => {
    const { docs } = setup();
    expect(
      (await callJob('PUT', { ...job, dataFecho: '2027-02-31' })).status,
    ).toHaveBeenCalledWith(400);
    expect(docs.get('jobs/job-1')?.version).toBe(1);
  });
});
