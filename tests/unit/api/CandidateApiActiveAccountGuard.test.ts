import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import candidatePlansHandler from '../../../pages/api/candidate/plans';
import draftHandler from '../../../pages/api/drafts/[scope]';
import notificationsHandler from '../../../pages/api/notifications';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: Object.assign(jest.fn(), {
      FieldValue: { serverTimestamp: jest.fn() },
      Timestamp: { fromMillis: jest.fn() },
    }),
  },
}));

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn(),
}));

jest.mock('../../../lib/apiUserAuth', () => ({
  requireActiveApiUser: jest.fn(),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn(),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
}));

const mockedRateLimit = jest.mocked(enforceApiRateLimit);
const mockedActiveUser = jest.mocked(requireActiveApiUser);

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

describe('consumidores do guard central de conta ativa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRateLimit.mockResolvedValue(true);
    mockedActiveUser.mockImplementation(async (_req, res) => {
      res.status(403).json({
        code: 'ACCOUNT_BLOCKED',
        error: 'Esta conta está suspensa ou inativa.',
      });
      return null;
    });
  });

  test.each([
    {
      name: 'notifications',
      handler: notificationsHandler,
      request: { body: {}, headers: {}, method: 'GET', query: {} },
    },
    {
      name: 'candidate/plans',
      handler: candidatePlansHandler,
      request: { body: {}, headers: {}, method: 'GET', query: {} },
    },
    {
      name: 'drafts/[scope]',
      handler: draftHandler,
      request: {
        body: {},
        headers: {},
        method: 'GET',
        query: { resourceId: 'default', scope: 'candidate-profile' },
      },
    },
  ])('$name termina antes da lógica de negócio', async ({ handler, request }) => {
    const response = createResponse();

    await handler(request as never, response as never);

    expect(mockedActiveUser).toHaveBeenCalledWith(
      request,
      response,
      expect.any(Object),
    );
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      code: 'ACCOUNT_BLOCKED',
      error: 'Esta conta está suspensa ou inativa.',
    });
  });
});
