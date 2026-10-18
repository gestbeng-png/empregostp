import { act, render, screen, waitFor } from '@testing-library/react';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { createServerSession } from '@/lib/authSessionClient';

let mockFailure = false;
let mockReads = 0;
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn();
jest.mock('@/lib/authClientRuntime', () => ({
  get auth() {
    mockReads++;
    if (mockFailure) throw new Error('SDK_UNAVAILABLE');
    return {};
  },
  onIdTokenChanged: (...args: unknown[]) => mockSubscribe(...args),
  signOut: jest.fn(),
}));
jest.mock('@/lib/authSessionClient', () => ({
  createServerSession: jest.fn(),
  destroyServerSession: jest.fn(),
}));

function Probe() {
  const { loading } = useAuth();
  return <h1>{loading ? 'A carregar sessão' : 'Sessão resolvida'}</h1>;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockFailure = false;
  mockReads = 0;
  mockSubscribe.mockReturnValue(mockUnsubscribe);
});

test('runtime is asynchronous; unmount before it arrives never registers a listener', async () => {
  const { unmount } = render(
    <AuthProvider renderWhileLoading>
      <Probe />
    </AuthProvider>,
  );
  expect(mockSubscribe).not.toHaveBeenCalled();
  unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockSubscribe).not.toHaveBeenCalled();
});

test('failed runtime does not declare an anonymous session and retries once online', async () => {
  mockFailure = true;
  render(
    <AuthProvider renderWhileLoading>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(mockReads).toBe(1));
  expect(screen.getByRole('heading')).toHaveTextContent('A carregar sessão');
  expect(mockSubscribe).not.toHaveBeenCalled();
  mockFailure = false;
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
  const listener = mockSubscribe.mock.calls[0]?.[1] as (
    user: unknown,
  ) => Promise<void>;
  await act(async () => listener(null));
  expect(screen.getByRole('heading')).toHaveTextContent('Sessão resolvida');
  window.dispatchEvent(new Event('online'));
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
});

test('late callback after unmount cannot recreate cookies; listener is cleaned up', async () => {
  const { unmount } = render(
    <AuthProvider renderWhileLoading>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
  const listener = mockSubscribe.mock.calls[0]?.[1] as (
    user: unknown,
  ) => Promise<void>;
  unmount();
  await listener({ getIdToken: async () => 'synthetic-token' });
  expect(createServerSession).not.toHaveBeenCalled();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});
