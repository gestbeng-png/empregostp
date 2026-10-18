import { act, render, screen, waitFor } from '@testing-library/react';
import { onIdTokenChanged } from 'firebase/auth';
import { renderToString } from 'react-dom/server';

import { AuthProvider, useAuth } from '../../../context/AuthContext';

jest.mock('firebase/auth', () => ({
  onIdTokenChanged: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../../../lib/firebaseAuth', () => ({
  auth: { currentUser: null, name: 'auth' },
}));

jest.mock('../../../lib/authSessionClient', () => ({
  createServerSession: jest.fn(),
  destroyServerSession: jest.fn(),
}));

const mockedAuthState = jest.mocked(onIdTokenChanged);

function Probe() {
  const { loading } = useAuth();
  return <h1>{loading ? 'Vaga (sessão a carregar)' : 'Vaga'}</h1>;
}

describe('AuthProvider em rotas públicas (SEO-01)', () => {
  let resolveAuth: (user: unknown) => Promise<void> | void = () => {};

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthState.mockImplementation((_auth, callback) => {
      resolveAuth = callback as (user: unknown) => Promise<void>;
      return jest.fn();
    });
  });

  it('o HTML do servidor contém o conteúdo da página pública', () => {
    const html = renderToString(
      <AuthProvider renderWhileLoading>
        <Probe />
      </AuthProvider>,
    );

    expect(html).toContain('Vaga (sessão a carregar)');
  });

  it('sem a opção, mantém o comportamento dos dashboards: nada até a sessão resolver', () => {
    const html = renderToString(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(html).not.toContain('Vaga');
  });

  it('a página pública recebe loading=false quando o Firebase responde', async () => {
    render(
      <AuthProvider renderWhileLoading>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent(
      'Vaga (sessão a carregar)',
    );

    // A sessão arranca na primeira interação (ou quando o browser fica livre).
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    await waitFor(() => expect(mockedAuthState).toHaveBeenCalledTimes(1));

    await act(async () => {
      await resolveAuth(null);
    });

    expect(screen.getByRole('heading')).toHaveTextContent(/^Vaga$/);
  });
});
