import { createOutboxRuntime } from '@/infrastructure/firebase/marketplace/createOutboxRuntime';
import { FirestoreHealthProbe } from '@/infrastructure/firebase/marketplace/FirestoreHealthProbe';
import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';
import handler from '@/pages/api/admin/operations';

jest.mock('@/lib/apiUserAuth', () => ({ requireActiveApiUser: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ admin: { firestore: jest.fn() } }));
jest.mock('@/infrastructure/firebase/marketplace/FirestoreHealthProbe', () => ({
  FirestoreHealthProbe: jest.fn(),
}));
jest.mock('@/infrastructure/firebase/marketplace/createOutboxRuntime', () => ({
  createOutboxRuntime: jest.fn(),
}));
jest.mock('@/infrastructure/observability/logger', () => ({
  logEvent: jest.fn(),
}));

const response = () => ({
  setHeader: jest.fn(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});
beforeEach(() => jest.resetAllMocks());
test('method and unauthenticated/blocked identities never access the queue', async () => {
  const res = response();
  await handler({ method: 'POST' } as never, res as never);
  expect(res.status).toHaveBeenCalledWith(405);
  expect(requireActiveApiUser).not.toHaveBeenCalled();
  jest.mocked(requireActiveApiUser).mockResolvedValue(null);
  await handler({ method: 'GET' } as never, res as never);
  expect(admin.firestore).not.toHaveBeenCalled();
});
test.each(['candidato', 'empresa', 'moderador'])(
  'role %s cannot read operational aggregates',
  async (userType) => {
    jest
      .mocked(requireActiveApiUser)
      .mockResolvedValue({ userData: { userType } } as never);
    const res = response();
    await handler({ method: 'GET' } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(admin.firestore).not.toHaveBeenCalled();
  },
);
test('ADMIN sees only queue aggregates; unarmed runtime is never instantiated', async () => {
  const originalArm = process.env.V2_OUTBOX_PROCESSOR_ENABLED;
  delete process.env.V2_OUTBOX_PROCESSOR_ENABLED;
  try {
    jest
      .mocked(requireActiveApiUser)
      .mockResolvedValue({ userData: { userType: 'admin' } } as never);
    jest
      .mocked(admin.firestore)
      .mockReturnValue({
        collection: () => ({
          doc: () => ({ get: async () => ({ data: () => undefined }) }),
        }),
      } as never);
    jest
      .mocked(FirestoreHealthProbe)
      .mockImplementation(
        () =>
          ({ queue: async () => ({ oldestDueAgeMs: 0, dead: 0 }) }) as never,
      );
    const res = response();
    await handler({ method: 'GET' } as never, res as never);
    expect(res.json).toHaveBeenCalledWith({
      oldestDueAgeMs: 0,
      dead: 0,
      lastOutboxRunAtMs: null,
      outboxExpected: false,
      alerts: [],
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
    expect(createOutboxRuntime).not.toHaveBeenCalled();
  } finally {
    if (originalArm === undefined)
      delete process.env.V2_OUTBOX_PROCESSOR_ENABLED;
    else process.env.V2_OUTBOX_PROCESSOR_ENABLED = originalArm;
  }
});
test('failures return a stable code without sensitive exception text', async () => {
  jest
    .mocked(requireActiveApiUser)
    .mockRejectedValue(new Error('private@example.test'));
  const res = response();
  await handler({ method: 'GET' } as never, res as never);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ code: 'OPERATIONS_UNAVAILABLE' });
});
