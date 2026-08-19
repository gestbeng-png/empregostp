/**
 * @jest-environment jsdom
 */

jest.mock('../../../lib/firebase', () => ({ app: {} }));

const mockIsSupported = jest.fn();
jest.mock('firebase/messaging', () => ({
  getMessaging: jest.fn(),
  getToken: jest.fn(),
  isSupported: mockIsSupported,
  onMessage: jest.fn(),
}));

describe('isolamento de push no modo emulador', () => {
  const originalMode = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    } else {
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = originalMode;
    }
    jest.clearAllMocks();
  });

  test('não inicializa Firebase Messaging nem pede token real', async () => {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    const {
      isWebPushSupported,
      registerWebPushToken,
    } = await import('../../../lib/webPushClient');

    await expect(isWebPushSupported()).resolves.toBe(false);
    await expect(registerWebPushToken()).rejects.toThrow(
      'desativadas no modo de testes',
    );
    expect(mockIsSupported).not.toHaveBeenCalled();
  });
});
