import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { admin } from '../../../lib/firebaseAdmin';
import registrationHandler from '../../../pages/api/auth/register';
import contactHandler from '../../../pages/api/contact/index';
import jobAlertsHandler from '../../../pages/api/job-alerts/index';
import newsletterHandler from '../../../pages/api/newsletter/subscribe';
import notificationsHandler from '../../../pages/api/notifications';
import subscribePlanHandler from '../../../pages/api/subscribe-plan';
import testimonialsHandler from '../../../pages/api/testimonials/index';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
  });
  const mockedAdmin = {
    auth: jest.fn(),
    firestore,
  };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn(),
  getClientIp: jest.fn(() => '203.0.113.99'),
}));

jest.mock('../../../lib/email', () => ({
  isEmailConfigured: jest.fn(() => false),
  sendEmail: jest.fn(),
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn(),
  sendPushToUser: jest.fn(),
}));

jest.mock('../../../lib/email/jobAlertEmail', () => ({
  buildJobAlertEmail: jest.fn(),
  filterPublishedJobs: jest.fn(),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;
const mockedEnforce = jest.mocked(enforceApiRateLimit);

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

type Handler = (req: unknown, res: unknown) => unknown;

const ROUTES: Array<{
  handler: Handler;
  limit: number;
  method: string;
  name: string;
  scope: string;
}> = [
  {
    handler: registrationHandler as Handler,
    limit: 5,
    method: 'POST',
    name: 'auth/register',
    scope: 'register',
  },
  {
    handler: contactHandler as Handler,
    limit: 5,
    method: 'POST',
    name: 'contact',
    scope: 'contact',
  },
  {
    handler: newsletterHandler as Handler,
    limit: 5,
    method: 'POST',
    name: 'newsletter/subscribe',
    scope: 'newsletter_subscribe',
  },
  {
    handler: testimonialsHandler as Handler,
    limit: 3,
    method: 'POST',
    name: 'testimonials',
    scope: 'testimonials',
  },
  {
    handler: jobAlertsHandler as Handler,
    limit: 3,
    method: 'POST',
    name: 'job-alerts',
    scope: 'job_alerts',
  },
  {
    handler: notificationsHandler as Handler,
    limit: 30,
    method: 'GET',
    name: 'notifications',
    scope: 'notifications',
  },
  {
    handler: subscribePlanHandler as Handler,
    limit: 10,
    method: 'POST',
    name: 'subscribe-plan',
    scope: 'subscribe_plan',
  },
];

describe('migração das rotas para o limitador Firestore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each(ROUTES)('rota $name', ({ handler, limit, method, scope }) => {
    test(`usa o guard com scope "${scope}" e limite ${limit}/min e pára no 429`, async () => {
      mockedEnforce.mockImplementation(async (_req, res) => {
        const blockedResponse = res as ReturnType<typeof createResponse>;
        blockedResponse.setHeader('Retry-After', '60');
        blockedResponse.status(429).json({
          error: 'Demasiados pedidos. Tente novamente dentro de um minuto.',
        });
        return false;
      });

      const response = createResponse();
      await handler(
        {
          body: {},
          headers: { 'x-forwarded-for': '203.0.113.99' },
          method,
          query: {},
        },
        response,
      );

      expect(mockedEnforce).toHaveBeenCalledTimes(1);
      expect(mockedEnforce).toHaveBeenCalledWith(
        expect.anything(),
        response,
        expect.objectContaining({ limit, scope }),
      );
      expect(response.status).toHaveBeenCalledWith(429);
      expect(authMock).not.toHaveBeenCalled();
      expect(firestoreMock).not.toHaveBeenCalled();
    });
  });

  test('a rota de testemunhos mantém a mensagem própria de submissões', async () => {
    mockedEnforce.mockResolvedValue(false);

    const response = createResponse();
    await testimonialsHandler(
      {
        body: {},
        headers: {},
        method: 'POST',
        query: {},
      },
      response,
    );

    expect(mockedEnforce).toHaveBeenCalledWith(
      expect.anything(),
      response,
      expect.objectContaining({
        message: 'Demasiadas submissões. Tente novamente dentro de um minuto.',
      }),
    );
  });
});
