import { admin } from '@/lib/firebaseAdmin';
import { logServerError } from '@/lib/serverLog';
import handler from '@/pages/api/applications/[id]/timeline';

jest.mock('@/lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));
jest.mock('@/lib/serverLog', () => ({ logServerError: jest.fn() }));

const mockVerify = jest.fn();
const mockCollection = jest.fn();
const mockApplicationGet = jest.fn();
const mockHistoryGet = jest.fn();
const mockInterviewGet = jest.fn();
const mockHireGet = jest.fn();
const mockOfferGet = jest.fn();
let mockUser: Record<string, unknown>;
const doc = (data: Record<string, unknown> | null) => ({
  exists: data !== null,
  data: () => data,
});
const request = (overrides = {}) => ({
  method: 'GET',
  query: { id: 'application-1' },
  headers: { authorization: 'Bearer synthetic-token' },
  ...overrides,
});
function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { userType: 'candidato', status: 'active' };
  mockVerify.mockReset().mockResolvedValue({ uid: 'candidate-1' });
  mockApplicationGet.mockReset().mockResolvedValue(
    doc({
      candidateUserId: 'candidate-1',
      jobId: 'job-1',
      v2Status: 'SHORTLISTED',
      internalNotes: 'PRIVATE_APPLICATION_MARKER',
      rating: 5,
      jobSnapshot: { titulo: 'Assistente', companyName: 'Empresa de teste' },
    }),
  );
  mockHistoryGet.mockReset().mockResolvedValue({
    docs: [
      doc({
        to: 'SHORTLISTED',
        at: new Date('2026-10-01T09:00:00Z'),
        candidateVisibleNote: 'Estamos a analisar o seu perfil.',
        internalNote: 'PRIVATE_HISTORY_MARKER',
        tags: ['PRIVATE_TAG_MARKER'],
      }),
    ],
  });
  mockInterviewGet.mockReset().mockResolvedValue({ docs: [] });
  mockHireGet.mockReset().mockResolvedValue(doc(null));
  mockOfferGet.mockReset().mockResolvedValue({ docs: [] });
  mockCollection.mockImplementation((name: string) => {
    if (name === 'users')
      return { doc: () => ({ get: async () => doc(mockUser) }) };
    if (name === 'applications')
      return { doc: () => ({ get: mockApplicationGet }) };
    if (name === 'applicationsStatusHistory')
      return {
        where: () => ({ get: mockHistoryGet }),
      };
    if (name === 'interviews')
      return { where: () => ({ get: mockInterviewGet }) };
    if (name === 'hires') return { doc: () => ({ get: mockHireGet }) };
    if (name === 'offers') return { where: () => ({ get: mockOfferGet }) };
    throw new Error(`Unexpected collection: ${name}`);
  });
  (admin.auth as unknown as jest.Mock).mockReturnValue({
    verifyIdToken: mockVerify,
  });
  (admin.firestore as unknown as jest.Mock).mockReturnValue({
    collection: mockCollection,
  });
});

test('owner receives only candidate-visible fields and private no-store caching', async () => {
  const res = response();
  await handler(request(), res);
  expect(mockVerify).toHaveBeenCalledWith('synthetic-token', true);
  expect(res.setHeader).toHaveBeenCalledWith(
    'Cache-Control',
    'private, no-store',
  );
  expect(res.status).toHaveBeenCalledWith(200);
  const body = res.json.mock.calls[0]?.[0];
  expect(body).toMatchObject({
    applicationId: 'application-1',
    statusLabel: 'Em análise',
    timeline: [
      {
        label: 'Em análise',
        date: '1 out. 2026',
        note: 'Estamos a analisar o seu perfil.',
      },
    ],
    interviews: [],
    offers: [],
    hireConfirmation: null,
  });
  expect(JSON.stringify(body)).not.toMatch(
    /PRIVATE_|SHORTLISTED|rating|internalNote|tags/,
  );
});

test('sent offers reach the candidate; drafts and internal fields never do', async () => {
  mockOfferGet.mockResolvedValue({
    docs: [
      {
        id: 'offer-draft',
        data: () => ({ v2Status: 'DRAFT', amountMinor: 100, createdBy: 'x' }),
      },
      {
        id: 'offer-sent',
        data: () => ({
          v2Status: 'SENT',
          version: 1,
          amountMinor: 1_500_000,
          currency: 'STN',
          period: 'MONTH',
          startDate: '2026-11-02',
          expiresAt: new Date('2099-01-01T23:59:59Z'),
          message: 'Bem-vinda.',
          createdBy: 'PRIVATE_RECRUITER_MARKER',
          organizationId: 'PRIVATE_ORG_MARKER',
        }),
      },
    ],
  });
  const res = response();
  await handler(request(), res);
  const body = res.json.mock.calls[0]?.[0];
  expect(body.offers).toEqual([
    expect.objectContaining({
      id: 'offer-sent',
      status: 'SENT',
      amountMinor: 1_500_000,
      currency: 'STN',
      period: 'MONTH',
    }),
  ]);
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE_|offer-draft/);
});

test.each([
  null,
  { candidateUserId: 'other-candidate', v2Status: 'SUBMITTED' },
])(
  'missing and foreign applications are indistinguishable (%j)',
  async (application) => {
    mockApplicationGet.mockResolvedValue(doc(application));
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Candidatura não encontrada.',
      },
    });
    expect(mockHistoryGet).not.toHaveBeenCalled();
    expect(mockInterviewGet).not.toHaveBeenCalled();
    expect(mockHireGet).not.toHaveBeenCalled();
  },
);

test('legacy owner is supported, but legacy applications do not invent a v2 history', async () => {
  mockApplicationGet.mockResolvedValue(
    doc({ candidateId: 'candidate-1', status: 'pending' }),
  );
  const res = response();
  await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith({
    error: {
      code: 'LEGACY_APPLICATION',
      message: 'Esta candidatura usa o acompanhamento anterior.',
    },
  });
  expect(mockHistoryGet).not.toHaveBeenCalled();
});

test.each(['../other', '', 'invalid/id', 'x'.repeat(301)])(
  'rejects invalid id %s',
  async (id) => {
    const res = response();
    await handler(request({ query: { id } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockApplicationGet).not.toHaveBeenCalled();
  },
);

test('revoked session cannot read application data', async () => {
  mockVerify.mockRejectedValue(new Error('auth/id-token-revoked'));
  const res = response();
  await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(mockApplicationGet).not.toHaveBeenCalled();
});

test('blocked account cannot read application data', async () => {
  mockUser = { userType: 'candidato', status: 'suspended' };
  const res = response();
  await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(mockApplicationGet).not.toHaveBeenCalled();
});

test('missing session is rejected before Firebase reads', async () => {
  const res = response();
  await handler(request({ headers: {} }), res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(mockVerify).not.toHaveBeenCalled();
  expect(mockCollection).not.toHaveBeenCalled();
});

test('rejects write methods without database access', async () => {
  const res = response();
  await handler(request({ method: 'POST' }), res);
  expect(res.status).toHaveBeenCalledWith(405);
  expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET']);
  expect(mockCollection).not.toHaveBeenCalled();
});

test('server failures use a generic message, not SDK error details', async () => {
  mockHistoryGet.mockRejectedValue(new Error('PRIVATE_DATABASE_ERROR'));
  const res = response();
  await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain(
    'PRIVATE_DATABASE_ERROR',
  );
  expect(logServerError).toHaveBeenCalledWith(
    'applications.timeline_failed',
    expect.any(Error),
  );
});
