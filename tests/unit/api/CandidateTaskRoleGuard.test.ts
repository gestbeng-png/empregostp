import { admin } from '../../../lib/firebaseAdmin';
import applicationsHandler from '../../../pages/api/applications';
import savedJobsHandler from '../../../pages/api/saved-jobs';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));
jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));
jest.mock('../../../lib/email', () => ({
  isEmailConfigured: jest.fn(),
  sendEmail: jest.fn(),
}));
jest.mock(
  '../../../infrastructure/firebase/applications/createSubmitApplication',
  () => ({ getSubmitApplication: jest.fn() }),
);

function response() {
  const res = { json: jest.fn(), status: jest.fn() };
  res.json.mockReturnValue(res);
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

test.each(['empresa', 'admin'])(
  '%s é recusado nas APIs de candidatura e de vagas guardadas antes de qualquer alteração',
  async (userType) => {
    const verifyIdToken = jest
      .fn()
      .mockResolvedValue({ uid: 'synthetic-account' });
    const collection = jest.fn().mockImplementation((name) => {
      if (name !== 'users')
        throw new Error('Não devia aceder aos dados de candidato');
      return {
        doc: jest
          .fn()
          .mockReturnValue({
            get: jest
              .fn()
              .mockResolvedValue({
                exists: true,
                data: () => ({ userType, status: 'active' }),
              }),
          }),
      };
    });
    jest.mocked(admin.auth).mockReturnValue({ verifyIdToken } as never);
    jest.mocked(admin.firestore).mockReturnValue({ collection } as never);

    for (const handler of [applicationsHandler, savedJobsHandler]) {
      const res = response();
      await handler(
        {
          method: 'POST',
          headers: { authorization: 'Bearer synthetic-token' },
          body: { jobId: 'synthetic-job' },
          query: {},
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(verifyIdToken).toHaveBeenCalledWith('synthetic-token', true);
    }
    expect(collection.mock.calls).toEqual([['users'], ['users']]);
  },
);

test('sem sessão, ambas as APIs recusam o pedido sem consultar dados', async () => {
  for (const handler of [applicationsHandler, savedJobsHandler]) {
    const res = response();
    await handler(
      {
        method: 'POST',
        headers: {},
        body: { jobId: 'synthetic-job' },
        query: {},
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  }
  expect(admin.firestore).not.toHaveBeenCalled();
});
