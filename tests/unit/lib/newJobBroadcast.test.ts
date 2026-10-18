import { isEmailConfigured, sendEmail } from '@/lib/email';
import { broadcastNewJob } from '@/lib/newJobBroadcast';

jest.mock('@/lib/email', () => ({
  isEmailConfigured: jest.fn(() => false),
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'synthetic' }),
  getDefaultFrom: () => 'synthetic@example.test',
}));
jest.mock('@/lib/authEmails', () => ({
  resolveBaseUrl: () => 'https://example.test',
}));
jest.mock('@/lib/newJobEmail', () => ({
  buildNewJobEmail: () => ({
    subject: 'Synthetic',
    text: 'Synthetic',
    html: '<p>Synthetic</p>',
  }),
}));
jest.mock('@/lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isEmailConfigured).mockReturnValue(false);
});

const basic = {
  status: 'active',
  currentPlan: 'basic_candidato',
  email: 'basic@example.test',
};
const premium = {
  status: 'active',
  currentPlan: 'unlimited_candidato',
  email: 'premium@example.test',
};
type Candidate = { status: string; currentPlan: string; email: string };

function fixture(
  candidates: Candidate[] = [basic, premium],
  profiles: Record<string, unknown> = {},
) {
  const job: Record<string, unknown> = {
    status: 'active',
    dataFecho: '2999-01-01',
    titulo: 'Vaga guardada',
    localizacao: 'São Tomé',
  };
  const set = jest.fn();
  const commit = jest.fn().mockResolvedValue(undefined);
  const mark = jest.fn(async (value: Record<string, unknown>) => {
    Object.assign(job, value);
  });
  const collection = jest.fn((name: string) => {
    if (name === 'jobs') return { doc: () => ({ set: mark }) };
    if (name === 'users')
      return {
        where: () => ({
          get: async () => ({
            docs: candidates.map((data, index) => ({
              id: String(index),
              data: () => data,
            })),
          }),
        }),
      };
    if (name === 'notifications')
      return { doc: () => ({ id: 'notification' }) };
    if (name === 'profiles') return { doc: (id: string) => ({ id }) };
    throw new Error('Unexpected synthetic collection');
  });
  const firestore = Object.assign(
    () => ({
      collection,
      batch: () => ({ set, commit }),
      getAll: async (...refs: Array<{ id: string }>) =>
        refs.map(({ id }) => ({
          id,
          exists: true,
          data: () => profiles[id] || {},
        })),
    }),
    { FieldValue: { serverTimestamp: () => 'synthetic-time' } },
  );
  return { admin: { firestore }, job, set, commit, mark, collection };
}

test('published jobs notify both free and paid candidates through the single server flow', async () => {
  const f = fixture();
  expect(
    await broadcastNewJob(f.admin, { job: f.job, jobId: 'job' }),
  ).toMatchObject({ notificados: 2, emails: 0 });
  expect(
    f.set.mock.calls.map(([, notification]) => notification.userId),
  ).toEqual(['0', '1']);
  expect(f.mark).toHaveBeenCalledTimes(1);
  expect(sendEmail).not.toHaveBeenCalled();
});

test('suspended accounts are never notified', async () => {
  const f = fixture([basic, { ...premium, status: 'suspended' }]);
  await broadcastNewJob(f.admin, { job: f.job, jobId: 'job' });
  expect(f.set).toHaveBeenCalledTimes(1);
});

test.each(['pending_review', 'closed'])(
  'a %s job cannot trigger the replacement notification flow',
  async (status) => {
    const f = fixture();
    expect(
      await broadcastNewJob(f.admin, {
        job: { ...f.job, status },
        jobId: 'job',
      }),
    ).toMatchObject({ notificados: 0, emails: 0 });
    expect(f.collection).not.toHaveBeenCalled();
    expect(f.commit).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  },
);

test('retrying an already marked publication does not duplicate notifications', async () => {
  const f = fixture();
  await broadcastNewJob(f.admin, { job: f.job, jobId: 'job' });
  await broadcastNewJob(f.admin, { job: f.job, jobId: 'job' });
  expect(f.set).toHaveBeenCalledTimes(2);
  expect(f.commit).toHaveBeenCalledTimes(1);
});

test('email preferences are honored while in-app notifications remain free for everyone', async () => {
  jest.mocked(isEmailConfigured).mockReturnValue(true);
  const f = fixture([basic, premium], {
    '1': { settings: { notifications: { jobAlerts: false } } },
  });
  expect(
    await broadcastNewJob(f.admin, { job: f.job, jobId: 'job' }),
  ).toMatchObject({ notificados: 2, emails: 1 });
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({ bcc: ['basic@example.test'] }),
  );
});
