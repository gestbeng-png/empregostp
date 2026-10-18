import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CandidateSettings from '@/components/candidates/CandidateSettings';
import { createDefaultCandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import { pt } from '@/shared/i18n/pt';

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn() },
  getAuth: jest.fn(() => ({
    currentUser: { getIdToken: jest.fn(async () => 'candidate-token') },
  })),
  reauthenticateWithCredential: jest.fn(),
  updatePassword: jest.fn(),
}));

const copy = pt.candidateSettings.deleteAccount;
const pending = {
  status: 'PENDING',
  requestedAt: '2026-10-11T12:00:00.000Z',
  executeAfter: '2026-10-18T12:00:00.000Z',
};

function reply(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('Eliminar conta (H5)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function renderSettings() {
    render(
      <CandidateSettings
        profile={{ settings: createDefaultCandidateSettings() }}
        user={{ providerData: [{ providerId: 'password' }] }}
        onOpenSupport={jest.fn()}
      />,
    );
  }

  it('só aceita o pedido depois de escrever ELIMINAR e mostra o prazo devolvido pelo servidor', async () => {
    const user = userEvent.setup();
    let resolvePost: (value: Response) => void = () => {};
    const fetchMock = jest.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Promise<Response>((resolve) => {
            resolvePost = resolve;
          });
        }
        return reply(200, { deletion: null });
      },
    );
    global.fetch = fetchMock as typeof fetch;
    renderSettings();

    await user.click(
      screen.getByRole('button', {
        name: pt.candidateSettings.navigation.delete,
      }),
    );
    const submit = await screen.findByRole('button', { name: copy.action });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(copy.confirmLabel), 'eliminar');
    expect(submit).toBeEnabled();
    await user.click(submit);

    // Enquanto o servidor não responde: sem sucesso nem estado pendente.
    expect(screen.getByRole('button', { name: copy.sending })).toBeDisabled();
    expect(screen.queryByText(copy.pendingTitle)).not.toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      action: 'request_deletion',
      confirmation: 'eliminar',
    });

    resolvePost(reply(200, { deletion: pending }));
    expect(await screen.findByText(copy.pendingTitle)).toBeInTheDocument();
    expect(screen.getByText(/18 de outubro de 2026/)).toBeInTheDocument();
    expect(screen.getByText(copy.requested)).toBeInTheDocument();
  });

  it('mostra a mensagem do servidor quando a sessão é antiga', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? reply(400, {
              code: 'REAUTH_REQUIRED',
              error:
                'Por segurança, termine a sessão, volte a entrar e repita o pedido nos 5 minutos seguintes.',
            })
          : reply(200, { deletion: null }),
    ) as typeof fetch;
    renderSettings();

    await user.click(
      screen.getByRole('button', {
        name: pt.candidateSettings.navigation.delete,
      }),
    );
    await user.type(
      await screen.findByLabelText(copy.confirmLabel),
      'ELIMINAR',
    );
    await user.click(screen.getByRole('button', { name: copy.action }));

    expect(await screen.findByText(/volte a entrar/)).toBeInTheDocument();
    expect(screen.queryByText(copy.pendingTitle)).not.toBeInTheDocument();
  });

  it('com pedido pendente permite cancelar', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? reply(200, { deletion: null })
          : reply(200, { deletion: pending }),
    );
    global.fetch = fetchMock as typeof fetch;
    renderSettings();

    await user.click(
      screen.getByRole('button', {
        name: pt.candidateSettings.navigation.delete,
      }),
    );
    await user.click(await screen.findByRole('button', { name: copy.cancel }));

    await waitFor(() =>
      expect(screen.getByText(copy.cancelled)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(copy.confirmLabel)).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      action: 'cancel_deletion',
    });
  });
});
