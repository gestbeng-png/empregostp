import { inspect } from 'node:util';

import { sendPushToUser } from '../../../lib/serverNotifications';

function createFirestoreMock(tokens: string[]) {
  const batch = {
    commit: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
    set: jest.fn(),
  };
  const subscriptionCollection = {
    doc: jest.fn((id) => ({ id })),
    where: jest.fn(),
  };
  const get = jest.fn().mockResolvedValue({
    docs: tokens.map((token) => ({ data: () => ({ token }) })),
  });
  subscriptionCollection.where
    .mockReturnValueOnce(subscriptionCollection)
    .mockReturnValueOnce({ get });

  const firestore = Object.assign(
    jest.fn(() => ({
      batch: () => batch,
      collection: () => subscriptionCollection,
    })),
    {
      FieldValue: {
        serverTimestamp: jest.fn(() => 'server-timestamp'),
      },
    },
  );

  return { batch, firestore };
}

describe('logs e persistência segura de notificações push', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('não regista nem devolve detalhes quando o envio falha', async () => {
    const canary = 'token-fcm|candidato@example.test|Authorization';
    const error = Object.assign(new Error(canary), {
      code: 'messaging/internal-error',
      config: { data: canary, headers: { authorization: canary } },
    });
    const { firestore } = createFirestoreMock([canary]);
    const adminInstance = {
      apps: [{}],
      firestore,
      messaging: () => ({
        sendEachForMulticast: jest.fn().mockRejectedValue(error),
      }),
    };

    await expect(
      sendPushToUser(adminInstance, 'candidate-1', {
        message: canary,
        title: 'Comprovativo recebido',
      }),
    ).resolves.toEqual({ failed: 0, sent: 0 });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'push_delivery.request_failed',
      { category: 'messaging' },
    );
    expect(inspect(consoleErrorSpy.mock.calls, { depth: null })).not.toContain(
      canary,
    );
  });

  test('persiste apenas a categoria segura de falhas por token', async () => {
    const canary = 'token-fcm-super-secreto';
    const { batch, firestore } = createFirestoreMock([canary]);
    const adminInstance = {
      apps: [{}],
      firestore,
      messaging: () => ({
        sendEachForMulticast: jest.fn().mockResolvedValue({
          failureCount: 1,
          responses: [
            {
              error: Object.assign(new Error(canary), {
                code: 'messaging/internal-error',
              }),
              success: false,
            },
          ],
          successCount: 0,
        }),
      }),
    };

    await expect(
      sendPushToUser(adminInstance, 'candidate-1', {
        message: 'Mensagem de teste',
      }),
    ).resolves.toEqual({ failed: 1, sent: 0 });

    expect(batch.set).toHaveBeenCalledWith(
      expect.any(Object),
      {
        lastError: 'messaging',
        updatedAt: 'server-timestamp',
      },
      { merge: true },
    );
    expect(inspect(batch.set.mock.calls, { depth: null })).not.toContain(
      canary,
    );
  });
});
