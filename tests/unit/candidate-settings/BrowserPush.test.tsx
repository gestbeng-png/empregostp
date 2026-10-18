import { act, renderHook, waitFor } from '@testing-library/react';

import { useBrowserPush } from '@/components/candidates/useBrowserPush';

const isWebPushSupported = jest.fn();
const registerWebPushToken = jest.fn();
jest.mock('@/lib/webPushClient', () => ({
  isWebPushSupported: () => isWebPushSupported(),
  registerWebPushToken: () => registerWebPushToken(),
}));

const originalKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

function setPermission(permission: string) {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission },
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'vapid';
  isWebPushSupported.mockResolvedValue(true);
  registerWebPushToken.mockReset();
  setPermission('default');
});

afterAll(() => {
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = originalKey;
});

test('oferece a ativação a quem ainda não decidiu e ativa de facto', async () => {
  registerWebPushToken.mockResolvedValue('token');
  const { result } = renderHook(() => useBrowserPush(true));
  await waitFor(() => expect(result.current.state).toBe('available'));

  await act(async () => {
    await result.current.activate();
  });

  expect(registerWebPushToken).toHaveBeenCalledTimes(1);
  expect(result.current.state).toBe('active');
  expect(result.current.error).toBe('');
});

test('quem já autorizou não vê o botão', async () => {
  setPermission('granted');
  const { result } = renderHook(() => useBrowserPush(true));
  await waitFor(() => expect(result.current.state).toBe('active'));
});

test('recusa no browser dá uma mensagem compreensível', async () => {
  registerWebPushToken.mockRejectedValue(
    new Error('Permissão de notificações não concedida'),
  );
  const { result } = renderHook(() => useBrowserPush(true));
  await waitFor(() => expect(result.current.state).toBe('available'));

  setPermission('denied');
  await act(async () => {
    await result.current.activate();
  });

  expect(result.current.state).toBe('blocked');
  expect(result.current.error).toMatch(/definições do browser/);
});

test.each([
  ['sem suporte no browser', () => isWebPushSupported.mockResolvedValue(false)],
  [
    'sem chave configurada',
    () => {
      delete process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    },
  ],
])('fica escondido %s', async (_label, arrange) => {
  arrange();
  const { result } = renderHook(() => useBrowserPush(true));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(result.current.state).toBe('hidden');
});
