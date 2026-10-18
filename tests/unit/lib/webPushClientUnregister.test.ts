/**
 * @jest-environment jsdom
 */
import { unregisterCurrentPushToken } from '../../../lib/webPushClient';

jest.mock('../../../lib/firebaseApp', () => ({
  app: {},
  auth: {},
}));

const getIdToken = jest.fn();

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: { getIdToken },
  })),
}));

const TOKEN_STORAGE_KEY = 'web-push-token';

describe('unregisterCurrentPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem(TOKEN_STORAGE_KEY, 'fcm-token-1');
    getIdToken.mockResolvedValue('id-token');
    global.fetch = jest.fn();
  });

  test('remove o token local quando o servidor confirma a remoção', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    await unregisterCurrentPushToken();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/push-subscriptions',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  test('remove o token local quando o servidor responde 403 (token de outra conta)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });

    await unregisterCurrentPushToken();

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  test('mantem o token local quando o servidor falha, para nova tentativa', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await unregisterCurrentPushToken();

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('fcm-token-1');
  });

  test('mantem o token local quando a rede falha', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await unregisterCurrentPushToken();

    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('fcm-token-1');
  });

  test('mantem o token local quando ja nao ha sessao para autenticar a remocao', async () => {
    getIdToken.mockResolvedValue(null);

    await unregisterCurrentPushToken();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('fcm-token-1');
  });
});
