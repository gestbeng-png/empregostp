import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { getDefaultBasicPlanForUserType } from '../../../lib/defaultPlans';
import admin, { admin as namedAdmin } from '../../../lib/firebaseAdmin';
import registrationHandler from '../../../pages/api/auth/register';
import companyProfileHandler, {
  buildCompanyProfileUpdate,
} from '../../../pages/api/empresa';

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

  return {
    __esModule: true,
    admin: mockedAdmin,
    default: mockedAdmin,
  };
});

jest.mock('../../../lib/defaultPlans', () => ({
  getDefaultBasicPlanForUserType: jest.fn(),
}));

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn(),
}));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;
const namedAuthMock = namedAdmin.auth as unknown as jest.Mock;
const mockedRateLimit = jest.mocked(enforceApiRateLimit);
const mockedDefaultPlan = jest.mocked(getDefaultBasicPlanForUserType);

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

describe('segurança da atualização do perfil empresarial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('a allowlist exclui papel, plano, verificação e campos de faturação', () => {
    expect(
      buildCompanyProfileUpdate({
        companySize: ' 11–50 ',
        currentPlan: 'premium_empresa',
        description: ' Uma empresa local. ',
        email: 'atacante@example.com',
        industrySectors: [' Tecnologia ', 'Tecnologia', '', 42],
        name: ' Empresa Segura ',
        planEndDate: '2099-01-01',
        socialMedia: {
          facebook: ' https://facebook.com/empresa ',
          privileged: true,
        },
        userType: 'admin',
        verified: true,
      }),
    ).toEqual({
      companyName: 'Empresa Segura',
      companySize: '11–50',
      description: 'Uma empresa local.',
      fullName: 'Empresa Segura',
      industrySectors: ['Tecnologia'],
      name: 'Empresa Segura',
      facebook: 'https://facebook.com/empresa',
      'socialMedia.facebook': 'https://facebook.com/empresa',
    });
  });

  test('o endpoint persiste apenas campos editáveis e gera updatedAt no servidor', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const companyRef = {
      get: jest.fn().mockResolvedValue({
        data: () => ({ userType: 'empresa' }),
        exists: true,
      }),
      update,
    };
    const collection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue(companyRef),
    });
    firestoreMock.mockReturnValue({ collection });
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'company-1' }),
    });

    const response = createResponse();
    await companyProfileHandler(
      {
        body: {
          name: 'Empresa Segura',
          phone: '+239 900 0000',
          currentPlan: 'premium_empresa',
          planName: 'Ilimitado',
          userType: 'admin',
          verified: true,
        },
        headers: { authorization: 'Bearer valid-token' },
        method: 'PUT',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(update).toHaveBeenCalledTimes(1);
    const persisted = update.mock.calls[0][0];
    expect(persisted).toEqual(
      expect.objectContaining({
        companyName: 'Empresa Segura',
        fullName: 'Empresa Segura',
        name: 'Empresa Segura',
        phone: '+239 900 0000',
        updatedAt: 'server-timestamp',
      }),
    );
    expect(persisted).not.toHaveProperty('currentPlan');
    expect(persisted).not.toHaveProperty('planName');
    expect(persisted).not.toHaveProperty('userType');
    expect(persisted).not.toHaveProperty('verified');
  });
});

describe('segurança do registo público', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRateLimit.mockResolvedValue(true);
    mockedDefaultPlan.mockReturnValue({
      destaque: false,
      features: [],
      name: 'Básico',
      vagasLimit: 1,
    });
  });

  test('rejeita um papel administrativo antes de criar a conta', async () => {
    const createUser = jest.fn();
    namedAuthMock.mockReturnValue({ createUser });

    const response = createResponse();
    await registrationHandler(
      {
        body: {
          email: 'admin-falso@example.com',
          password: 'SenhaForte1!',
          userType: 'admin',
        },
        headers: { 'x-forwarded-for': '203.0.113.10' },
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(createUser).not.toHaveBeenCalled();
    expect(firestoreMock).not.toHaveBeenCalled();
  });

  test('ignora campos privilegiados e grava apenas o plano básico do papel validado', async () => {
    const createUser = jest
      .fn()
      .mockResolvedValue({ uid: 'new-company-user' });
    namedAuthMock.mockReturnValue({ createUser });

    const userSet = jest.fn().mockResolvedValue(undefined);
    const subscriptionSet = jest.fn().mockResolvedValue(undefined);
    const planGet = jest.fn().mockResolvedValue({ exists: false });
    const collection = jest.fn((name: string) => {
      if (name === 'plans') {
        return { doc: jest.fn().mockReturnValue({ get: planGet }) };
      }
      if (name === 'users') {
        return { doc: jest.fn().mockReturnValue({ set: userSet }) };
      }
      if (name === 'subscriptions') {
        return { doc: jest.fn().mockReturnValue({ set: subscriptionSet }) };
      }
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({ collection });

    const response = createResponse();
    await registrationHandler(
      {
        body: {
          currentPlan: 'premium_empresa',
          email: 'empresa@example.com',
          fullName: 'Empresa Nova',
          industrySectors: ['Tecnologia'],
          password: 'SenhaForte1!',
          planName: 'Ilimitado',
          role: 'admin',
          userType: 'empresa',
          verified: true,
        },
        headers: { 'x-forwarded-for': '203.0.113.11' },
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'empresa@example.com',
        emailVerified: false,
      }),
    );
    expect(userSet).toHaveBeenCalledTimes(1);
    const persisted = userSet.mock.calls[0][0];
    expect(persisted).toEqual(
      expect.objectContaining({
        currentPlan: 'basic_empresa',
        fullName: 'Empresa Nova',
        industrySectors: ['Tecnologia'],
        planId: 'basic_empresa',
        planName: 'Básico',
        userType: 'empresa',
      }),
    );
    expect(persisted).not.toHaveProperty('role');
    expect(persisted).not.toHaveProperty('verified');
    expect(subscriptionSet).toHaveBeenCalledTimes(1);
  });

  test('aplica rate limit antes de criar utilizadores', async () => {
    mockedRateLimit.mockImplementation(async (_req, res) => {
      (res as ReturnType<typeof createResponse>).status(429).json({
        error: 'Demasiados pedidos. Tente novamente dentro de um minuto.',
      });
      return false;
    });
    const createUser = jest.fn();
    namedAuthMock.mockReturnValue({ createUser });

    const response = createResponse();
    await registrationHandler(
      {
        body: {
          email: 'empresa@example.com',
          password: 'SenhaForte1!',
          userType: 'empresa',
        },
        headers: { 'x-real-ip': '203.0.113.12' },
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(429);
    expect(createUser).not.toHaveBeenCalled();
    expect(firestoreMock).not.toHaveBeenCalled();
  });
});
