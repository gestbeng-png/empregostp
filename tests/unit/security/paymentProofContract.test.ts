import { createHash } from 'node:crypto';

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

  type HashFixture = {
    hashRecord?: { requestId: string; userId: string } | null;
    linkedRequest?: Record<string, unknown> | null;
  };

  function mockUploadEnvironment({
    hashRecord = null,
    linkedRequest = null,
  }: HashFixture = {}) {
    const save = jest.fn().mockResolvedValue(undefined);
    const remove = jest.fn().mockResolvedValue(undefined);
    const file = jest.fn().mockReturnValue({ save, delete: remove });
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
      kind: 'request',
      get: jest.fn().mockResolvedValue({
        data: () => requestData,
        exists: true,
        id: 'request-1',
      }),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const linkedRef = { kind: 'linked' };
    const hashRefs: Array<{ kind: string; id: string }> = [];
    const transaction = {
      get: jest.fn(async (ref: { kind: string }) => {
        if (ref.kind === 'hash')
          return { data: () => hashRecord, exists: Boolean(hashRecord) };
        if (ref.kind === 'linked')
          return { data: () => linkedRequest, exists: Boolean(linkedRequest) };
        return { data: () => requestData, exists: true };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const runTransaction = jest.fn(async (callback) => callback(transaction));
    const batch = {
      commit: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    };
    const collection = jest.fn((name: string) => {
      if (name === 'subscription-requests') {
        return {
          doc: jest.fn((id: string) =>
            id === 'request-1' ? requestRef : linkedRef,
          ),
        };
      }
      if (name === 'paymentProofHashes') {
        return {
          doc: jest.fn((id: string) => {
            const ref = { kind: 'hash', id };
            hashRefs.push(ref);
            return ref;
          }),
        };
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

    return { hashRefs, remove, requestRef, save, transaction };
  }

  const pdf = Buffer.from('%PDF-1.7\ncomprovativo de teste');
  const pdfSha256 = createHash('sha256').update(pdf).digest('hex');

  function pdfUploadRequest() {
    return createRequest({
      contentType: 'application/pdf',
      fileBase64: `data:application/pdf;base64,${pdf.toString('base64')}`,
      proofName: 'recibo-malicioso.exe',
      size: 1,
    });
  }

  test('persiste apenas tipo, tamanho e extensão derivados no servidor', async () => {
    const { requestRef, save, transaction } = mockUploadEnvironment();

    const response = createResponse();
    await paymentProofHandler(pdfUploadRequest(), response);

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
      sha256: pdfSha256,
      size: pdf.length,
    });
  });

  test('reserva o hash do conteúdo na mesma transação', async () => {
    const { hashRefs, transaction } = mockUploadEnvironment();

    const response = createResponse();
    await paymentProofHandler(pdfUploadRequest(), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(hashRefs.map((ref) => ref.id)).toContain(pdfSha256);
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'hash', id: pdfSha256 }),
      expect.objectContaining({ requestId: 'request-1', userId: 'candidate-1' }),
    );
  });

  test('recusa o mesmo comprovativo noutro pedido em curso e apaga o ficheiro', async () => {
    const { remove, transaction } = mockUploadEnvironment({
      hashRecord: { requestId: 'request-0', userId: 'candidate-1' },
      linkedRequest: { status: 'approved', userId: 'candidate-1' },
    });

    const response = createResponse();
    await paymentProofHandler(pdfUploadRequest(), response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      error:
        'Este comprovativo já foi enviado noutro pedido. Envie o comprovativo da transferência deste pedido.',
    });
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });

  test('aceita reapresentar o comprovativo de um pedido rejeitado', async () => {
    const { transaction } = mockUploadEnvironment({
      hashRecord: { requestId: 'request-0', userId: 'candidate-1' },
      linkedRequest: { status: 'rejected', userId: 'candidate-1' },
    });

    const response = createResponse();
    await paymentProofHandler(pdfUploadRequest(), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(transaction.update).toHaveBeenCalled();
  });
});
