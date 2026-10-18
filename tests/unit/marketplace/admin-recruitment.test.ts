import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';
import handler from '@/pages/api/admin/recruitment';

import { createFakeFirestore } from '../../helpers/fakeFirestore';
jest.mock('@/lib/apiUserAuth', () => ({ requireActiveApiUser: jest.fn() }));
jest.mock('@/lib/firebaseAdmin', () => ({ admin: { firestore: jest.fn() } }));
jest.mock('@/lib/serverLog', () => ({ logServerError: jest.fn() }));
const response = () => ({
  setHeader: jest.fn(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});
beforeEach(() => jest.resetAllMocks());
test('unsupported method and missing authentication never query data', async () => {
  const res = response();
  await handler({ method: 'POST' } as never, res as never);
  expect(res.status).toHaveBeenCalledWith(405);
  expect(requireActiveApiUser).not.toHaveBeenCalled();
  jest.mocked(requireActiveApiUser).mockResolvedValue(null);
  await handler({ method: 'GET' } as never, res as never);
  expect(admin.firestore).not.toHaveBeenCalled();
});
test.each(['candidato', 'empresa'])(
  'non-admin %s cannot list hires',
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
test('admin receives only active hire identifiers, never candidate contacts or provider URLs', async () => {
  jest
    .mocked(requireActiveApiUser)
    .mockResolvedValue({ userData: { userType: 'admin' } } as never);
  const { db } = createFakeFirestore({
    'hires/h': {
      status: 'ACTIVE',
      applicationId: 'a',
      jobId: 'j',
      organizationId: 'org',
      candidateEmail: 'PRIVATE_CONTACT',
      cvUrl: 'PRIVATE_URL',
    },
    'hires/annulled': { status: 'ANNULLED' },
  });
  jest.mocked(admin.firestore).mockReturnValue(db);
  const res = response();
  await handler({ method: 'GET' } as never, res as never);
  expect(res.setHeader).toHaveBeenCalledWith(
    'Cache-Control',
    'private, no-store',
  );
  expect(res.json).toHaveBeenCalledWith({
    hires: [
      {
        id: 'h',
        applicationId: 'a',
        jobId: 'j',
        organizationId: 'org',
        status: 'ACTIVE',
        candidateConfirmation: 'PENDING',
      },
    ],
  });
});
test('unavailable storage returns a generic error without private exception text', async () => {
  jest
    .mocked(requireActiveApiUser)
    .mockRejectedValue(new Error('PRIVATE_CONTACT'));
  const res = response();
  await handler({ method: 'GET' } as never, res as never);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('PRIVATE_CONTACT');
});
