import { act, fireEvent, render, screen } from '@testing-library/react';

import JobReportPanel from '../../../components/jobs/JobReportPanel';

const mockGetIdToken = jest.fn();
const mockToken = { value: 'token-1' as string | null };
jest.mock('../../../lib/firebaseAuth', () => ({
  auth: {
    get currentUser() {
      return mockToken.value ? { getIdToken: mockGetIdToken } : null;
    },
  },
}));

describe('F1.8/E9 — painel de denúncia da vaga', () => {
  beforeEach(() => {
    mockToken.value = 'token-1';
    mockGetIdToken.mockResolvedValue('token-1');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Recebemos a sua denúncia.' }),
    }) as unknown as typeof fetch;
  });

  test('mostra o aviso de segurança e abre o formulário com «Pediram-me dinheiro»', () => {
    render(<JobReportPanel jobId="job1" loginHref="/login" />);
    expect(
      screen.getByText(
        'O EmpregoSTP nunca pede pagamentos para se candidatar.',
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /Pediram-me dinheiro/ }),
    );
    expect((screen.getByLabelText('Motivo') as HTMLSelectElement).value).toBe(
      'ASKED_FOR_MONEY',
    );
  });

  test('envia a denúncia e confirma sem revelar a ação tomada', async () => {
    render(<JobReportPanel jobId="job1" loginHref="/login" />);
    fireEvent.click(
      screen.getByRole('button', { name: /Pediram-me dinheiro/ }),
    );
    fireEvent.change(screen.getByLabelText('O que aconteceu? (opcional)'), {
      target: { value: 'Pediram 500 Db' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          targetType: 'JOB',
          targetId: 'job1',
          reason: 'ASKED_FOR_MONEY',
          details: 'Pediram 500 Db',
        }),
      }),
    );
    expect(await screen.findByText('Recebemos a sua denúncia.')).toBeTruthy();
    expect(screen.queryByLabelText('Motivo')).toBeNull();
  });

  test('sem sessão pede para iniciar sessão', async () => {
    mockToken.value = null;
    render(
      <JobReportPanel jobId="job1" loginHref="/login?redirect=/vaga/job1" />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Pediram-me dinheiro/ }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    });
    expect(
      screen.getByRole('link', { name: 'Iniciar sessão' }).getAttribute('href'),
    ).toBe('/login?redirect=/vaga/job1');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('o botão «Denunciar» existente abre o painel com «Outro motivo»; Esc fecha', () => {
    const { rerender } = render(
      <JobReportPanel jobId="job1" loginHref="/login" openSignal={0} />,
    );
    rerender(<JobReportPanel jobId="job1" loginHref="/login" openSignal={1} />);
    const select = screen.getByLabelText('Motivo') as HTMLSelectElement;
    expect(select.value).toBe('OTHER');
    fireEvent.keyDown(select, { key: 'Escape' });
    expect(screen.queryByLabelText('Motivo')).toBeNull();
  });

  test('erro do servidor aparece em aria-live', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { code: 'RATE_LIMITED', message: 'Fez muitas denúncias hoje.' },
      }),
    }) as unknown as typeof fetch;
    render(<JobReportPanel jobId="job1" loginHref="/login" />);
    fireEvent.click(
      screen.getByRole('button', { name: /Pediram-me dinheiro/ }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    });
    expect(
      (await screen.findByText(/Fez muitas denúncias hoje/)).closest(
        '[aria-live]',
      ),
    ).toBeTruthy();
  });
});
