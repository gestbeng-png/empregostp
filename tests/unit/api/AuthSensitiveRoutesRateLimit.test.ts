import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import {
  sendResetPasswordEmail,
  sendVerificationEmail,
} from '../../../lib/email/authEmails';
import { admin } from '../../../lib/firebaseAdmin';
import passwordResetHandler from '../../../pages/api/auth/send-password-reset';
import verificationHandler from '../../../pages/api/auth/send-verification';
import setupUserHandler from '../../../pages/api/auth/setup-user';

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn(),
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
}));

jest.mock('../../../lib/email/authEmails', () => ({
  resolveBaseUrl: jest.fn(() => 'https://empregostp.example'),
  sendResetPasswordEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
}));

jest.mock('../../../lib/defaultPlans', () => ({
  getDefaultBasicPlanForUserType: jest.fn(),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
  logServerWarning: jest.fn(),
}));

const mockedRateLimit = jest.mocked(enforceApiRateLimit);
const authMock = admin.auth as unknown as jest.Mock;

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

describe('rate limit fechado nas rotas sensíveis de autenticação', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRateLimit.mockImplementation(
      async (_req, res: ReturnType<typeof createResponse>) => {
        res.status(503).json({ error: 'limitador indisponível' });
        return false;
      },
    );
  });

  test.each([
    {
      handler: passwordResetHandler,
      scope: 'auth_password_reset',
    },
    {
      handler: verificationHandler,
      scope: 'auth_email_verification',
    },
    {
      handler: setupUserHandler,
      scope: 'auth_setup_user',
    },
  ])(
    '$scope não executa o efeito se o guard falhar',
    async ({ handler, scope }) => {
      const response = createResponse();
      await handler(
        {
          body: { email: 'candidate@example.test' },
          headers: { authorization: 'Bearer token' },
          method: 'POST',
        } as never,
        response as never,
      );

      expect(mockedRateLimit).toHaveBeenCalledWith(
        expect.anything(),
        response,
        expect.objectContaining({ failClosed: true, scope }),
      );
      expect(response.status).toHaveBeenCalledWith(503);
      expect(authMock).not.toHaveBeenCalled();
      expect(sendResetPasswordEmail).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    },
  );

  test('password reset aplica limite por IP e por hash do email antes de enviar', async () => {
    mockedRateLimit.mockResolvedValue(true);
    const response = createResponse();

    await passwordResetHandler(
      {
        body: { email: 'Candidate@Example.Test' },
        headers: { 'x-forwarded-for': '203.0.113.10' },
        method: 'POST',
      } as never,
      response as never,
    );

    expect(mockedRateLimit).toHaveBeenCalledTimes(2);
    // Indexar directamente devolve `T | undefined` em modo estrito; capturar
    // primeiro mantém as asserções legíveis sem silenciar o compilador.
    // `lib/apiRateLimit.js` não tem tipos, por isso o terceiro argumento é
    // anotado aqui em vez de inferido.
    type RateLimitOptions = {
      failClosed?: boolean;
      limit?: number;
      partition?: string;
      scope?: string;
    };
    const [ipCall, accountCall] = mockedRateLimit.mock.calls;
    const ipOptions = ipCall?.[2] as RateLimitOptions | undefined;
    const accountOptions = accountCall?.[2] as RateLimitOptions | undefined;

    expect(ipOptions).toEqual(
      expect.objectContaining({
        failClosed: true,
        scope: 'auth_password_reset',
      }),
    );
    expect(accountOptions).toEqual(
      expect.objectContaining({
        failClosed: true,
        limit: 3,
        partition: expect.stringMatching(/^email_[a-f0-9]{64}$/),
        scope: 'auth_password_reset_account',
      }),
    );
    expect(accountOptions?.partition).not.toContain('candidate@example.test');
    expect(sendResetPasswordEmail).toHaveBeenCalledTimes(1);

    const rateLimitOrder = mockedRateLimit.mock.invocationCallOrder[1];
    const emailOrder = (sendResetPasswordEmail as jest.Mock).mock
      .invocationCallOrder[0];
    // Garantir que ambos existem antes de comparar, para a ordem não passar
    // por omissão caso alguma das chamadas deixe de acontecer.
    expect(rateLimitOrder).toBeDefined();
    expect(emailOrder).toBeDefined();
    expect(Number(rateLimitOrder)).toBeLessThan(Number(emailOrder));
  });
});
