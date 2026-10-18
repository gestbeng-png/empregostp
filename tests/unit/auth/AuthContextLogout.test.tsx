import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { useState } from 'react';

import { AuthProvider, useAuth } from '../../../context/AuthContext';
import { destroyServerSession } from '../../../lib/authSessionClient';
import { unregisterCurrentPushToken } from '../../../lib/webPushClient';

jest.mock('firebase/auth', () => ({
  onIdTokenChanged: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../../../lib/firebaseAuth', () => ({
  auth: {
    currentUser: { getIdToken: jest.fn().mockResolvedValue('logout-token') },
    name: 'auth',
  },
}));

jest.mock('../../../lib/authSessionClient', () => ({
  createServerSession: jest.fn(),
  destroyServerSession: jest.fn(),
}));

jest.mock('../../../lib/webPushClient', () => ({
  unregisterCurrentPushToken: jest.fn(),
}));

const mockedAuthState = jest.mocked(onIdTokenChanged);
const mockedSignOut = jest.mocked(signOut);
const mockedDestroySession = jest.mocked(destroyServerSession);
const mockedUnregisterPush = jest.mocked(unregisterCurrentPushToken);

function LogoutProbe() {
  const { logout } = useAuth();
  const [result, setResult] = useState('');
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const outcome = await logout();
          setResult(outcome.success ? 'success' : 'failed');
        }}
      >
        Sair
      </button>
      <output>{result}</output>
    </>
  );
}

describe('logout centralizado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthState.mockImplementation((_auth, callback) => {
      (callback as (user: unknown) => void)({ uid: 'candidate-1' });
      return jest.fn();
    });
    mockedDestroySession.mockResolvedValue(undefined);
    mockedSignOut.mockResolvedValue(undefined);
    mockedUnregisterPush.mockResolvedValue(undefined);
  });

  test('expira a sessão servidor antes de terminar a sessão Firebase', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(screen.getByText('success')).toBeVisible());

    expect(mockedDestroySession).toHaveBeenCalledTimes(1);
    expect(mockedDestroySession).toHaveBeenCalledWith('logout-token');
    expect(mockedSignOut).toHaveBeenCalledTimes(1);
    const destroyOrder = mockedDestroySession.mock.invocationCallOrder[0];
    const signOutOrder = mockedSignOut.mock.invocationCallOrder[0];
    expect(destroyOrder).toBeDefined();
    expect(signOutOrder).toBeDefined();
    expect(destroyOrder ?? Infinity).toBeLessThan(signOutOrder ?? -Infinity);
  });

  test('não declara logout concluído se o servidor não apagar o cookie', async () => {
    mockedDestroySession.mockRejectedValue(new Error('server unavailable'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(screen.getByText('failed')).toBeVisible());

    expect(mockedSignOut).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
