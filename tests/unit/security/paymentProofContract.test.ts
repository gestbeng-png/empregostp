import { admin } from '../../../lib/firebaseAdmin';
import paymentProofHandler from '../../../pages/api/subscription-requests/[id]/payment-proof';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: {
      serverTimestamp: jest.fn(() => 'server-timestamp'),
    },
    Timestamp: {
      now: jest.fn(() => new Date('2026-08-01T12:00:00.000Z')),
    },
  });

  return {
    admin: {
      app: jest.fn(),
      auth: jest.fn(),
      firestore,
      storage: jest.fn(),
    },
  };
});

jest.mock('../../../lib/serverNotifications', () => ({
  sendPushToUser: jest.fn().mockResolvedValue({ failed: 0, sent: 0 }),
}));

const appMock = admin.app as unknown as jest.Mock;
const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const storageMock = admin.storage as unknown as jest.Mock;

function createResponse() {
  const response = {
    json: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function createRequest(body: Record<string, unknown>) {
  return {
    body,
    headers: { authorization: 'Bearer token-de-teste' },
    method: 'POST',
    query: { id: 'request-1' },
  };
}

describe('contrato do upload de comprovativos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
  });

  test.each([
    'https://phishing.example.test/comprovativo.pdf',
    'data:text/html;base64,PHNjcmlwdD4=',
    'https://firebasestorage.googleapis.com/v0/b/falso/o/recibo.pdf?token=falso',
  ])('rejeita proofUrl fornecido pelo cliente: %s', async (proofUrl) => {
    const response = createResponse();

    await paymentProofHandler(
      createRequest({ proofName: 'recibo.pdf', proofUrl }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Envie o comprovativo como ficheiro',
    });
    expect(firestoreMock).not.toHaveBeenCalled();
    expect(storageMock).not.toHaveBeenCalled();
  });

  test('persiste apenas tipo, tamanho e extensão derivados no servidor', async () => {
    const pdf = Buffer.from('%PDF-1.7\ncomprovativo de teste');
    const save = jest.fn().mockResolvedValue(undefined);
    const file = jest.fn().mockReturnValue({ save });
    const bucket = jest.fn().mockReturnValue({
      file,
      name: 'test-project.firebasestorage.app',
    });
    storageMock.mockReturnValue({ bucket });
    appMock.mockReturnValue({
      options: {
        projectId: 'test-project',
        storageBucket: 'test-project.firebasestorage.app',
      },
    });

    const requestData = {
      planId: 'professional-plan',
      planName: 'Profissional',
      price: 100,
      status: 'pending',
      userId: 'candidate-1',
    };
    const requestRef = {
      get: jest.fn().mockResolvedValue({
        data: () => requestData,
        exists: true,
        id: 'request-1',
      }),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const transaction = {
      get: jest.fn().mockResolvedValue({
        data: () => requestData,
        exists: true,
      }),
      update: jest.fn(),
    };
    const runTransaction = jest.fn(async (callback) => callback(transaction));
    const batch = {
      commit: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    };
    const collection = jest.fn((name: string) => {
      if (name === 'subscription-requests') {
        return { doc: jest.fn().mockReturnValue(requestRef) };
      }
      if (name === 'users') {
        return {
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      }
      if (name === 'notifications') {
        return { doc: jest.fn().mockReturnValue({ id: 'notification-1' }) };
      }
      throw new Error(`Coleção inesperada: ${name}`);
    });
    firestoreMock.mockReturnValue({
      batch: () => batch,
      collection,
      runTransaction,
    });

    const response = createResponse();
    await paymentProofHandler(
      createRequest({
        contentType: 'application/pdf',
        fileBase64: `data:application/pdf;base64,${pdf.toString('base64')}`,
        proofName: 'recibo-malicioso.exe',
        size: 1,
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(save).toHaveBeenCalledWith(
      pdf,
      expect.objectContaining({
        metadata: expect.objectContaining({
          contentDisposition: 'attachment; filename="recibo-malicioso.pdf"',
          contentType: 'application/pdf',
        }),
      }),
    );

    const writePayload =
      transaction.update.mock.calls[0]?.[1] ??
      requestRef.set.mock.calls[0]?.[0];
    expect(writePayload.paymentProof).toMatchObject({
      contentType: 'application/pdf',
      name: 'recibo-malicioso.pdf',
      size: pdf.length,
    });
  });
});
