import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { sendEmail } from '../../../lib/email';
import { admin } from '../../../lib/firebaseAdmin';
import {
  createJobAlertUnsubscribeToken,
  hashJobAlertUnsubscribeToken,
} from '../../../lib/jobAlertSubscription';
import jobAlertsHandler from '../../../pages/api/job-alerts/index';
import unsubscribeHandler from '../../../pages/api/job-alerts/unsubscribe';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    firestore: jest.fn(),
  },
}));

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn().mockResolvedValue(true),
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../lib/email', () => ({
  isEmailConfigured: jest.fn(() => true),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
}));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const rateLimitMock = jest.mocked(enforceApiRateLimit);
const sendEmailMock = jest.mocked(sendEmail);

function createResponse() {
  const response = {
    json: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.setHeader.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

describe('rotas de subscrição e cancelamento de alertas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitMock.mockResolvedValue(true);
    // Passar por `unknown` em vez de intersectar com o tipo real: a interseção
    // obrigava o mock a satisfazer também a assinatura `() => FieldValue`.
    (
      admin.firestore as unknown as {
        FieldValue: { serverTimestamp: jest.Mock };
      }
    ).FieldValue = {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    };
  });

  test('não cria nem envia novamente um alerta equivalente já confirmado', async () => {
    const equivalentRef = { set: jest.fn(), update: jest.fn() };
    const queryGet = jest.fn().mockResolvedValue({
      docs: [
        {
          id: 'existing-alert',
          ref: equivalentRef,
          data: () => ({
            active: true,
            confirmationEmailSent: true,
            unsubscribeTokenHash: 'a'.repeat(64),
            filters: {
              search: 'gestor',
              modalidade: 'remoto',
              minSalary: 0,
            },
          }),
        },
      ],
    });
    const where = jest.fn(() => ({ get: queryGet }));
    const doc = jest.fn();
    firestoreMock.mockReturnValue({
      collection: jest.fn(() => ({ where, doc })),
    });
    const response = createResponse();

    await jobAlertsHandler(
      {
        body: {
          email: 'pessoa@example.com',
          filters: { search: ' Gestor ', modalidade: 'REMOTO' },
        },
        headers: { 'user-agent': 'jest' },
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ deduplicated: true, emailSent: false }),
    );
    expect(doc).not.toHaveBeenCalled();
    expect(equivalentRef.set).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  test('rejeita token de cancelamento inválido sem alterar o alerta', async () => {
    const validToken = createJobAlertUnsubscribeToken();
    const alertRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          active: true,
          unsubscribeTokenHash: hashJobAlertUnsubscribeToken(validToken),
        }),
      }),
      update: jest.fn(),
    };
    firestoreMock.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => alertRef) })),
    });
    const response = createResponse();

    await unsubscribeHandler(
      {
        body: {
          alertId: 'alert-1',
          token: createJobAlertUnsubscribeToken(),
        },
        headers: {},
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(alertRef.update).not.toHaveBeenCalled();
  });

  test('cancela o alerta com token válido', async () => {
    const token = createJobAlertUnsubscribeToken();
    const alertRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          active: true,
          status: 'active',
          unsubscribeTokenHash: hashJobAlertUnsubscribeToken(token),
        }),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    firestoreMock.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => alertRef) })),
    });
    const response = createResponse();

    await unsubscribeHandler(
      {
        body: { alertId: 'alert-1', token },
        headers: {},
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(alertRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: false, status: 'unsubscribed' }),
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ alreadyUnsubscribed: false }),
    );
  });

  test('cancelamento repetido é idempotente', async () => {
    const token = createJobAlertUnsubscribeToken();
    const alertRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          active: false,
          status: 'unsubscribed',
          unsubscribeTokenHash: hashJobAlertUnsubscribeToken(token),
        }),
      }),
      update: jest.fn(),
    };
    firestoreMock.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => alertRef) })),
    });
    const response = createResponse();

    await unsubscribeHandler(
      {
        body: { alertId: 'alert-1', token },
        headers: {},
        method: 'POST',
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ alreadyUnsubscribed: true }),
    );
    expect(alertRef.update).not.toHaveBeenCalled();
  });
});
