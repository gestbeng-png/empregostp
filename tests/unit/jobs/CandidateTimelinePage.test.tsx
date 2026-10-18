import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { buildCandidateApplicationView } from '@/application/applications/candidateApplicationView';
import CandidaturasPage from '@/pages/dashboard/candidato/candidaturas';

const mockPush = jest.fn();
const mockToken = jest.fn().mockResolvedValue('synthetic-token');
const mockRouter = {
  isReady: true,
  query: {},
  pathname: '/dashboard/candidato/candidaturas',
  push: mockPush,
  replace: jest.fn(),
};
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/lib/serverSession', () => ({
  requireCandidateSession: jest.fn(),
}));
jest.mock('firebase/auth', () => ({
  getAuth: () => ({
    currentUser: { uid: 'candidate-1', getIdToken: mockToken },
  }),
}));

const application = {
  id: 'application-1',
  jobId: 'job-1',
  jobTitle: 'Assistente administrativo',
  company: 'Empresa de teste',
  status: 'analysis',
  v2Status: 'UNDER_REVIEW',
};
const view = buildCandidateApplicationView(
  application.id,
  application,
  [
    { to: 'SUBMITTED', at: new Date('2026-10-01T09:00:00Z') },
    {
      to: 'UNDER_REVIEW',
      at: new Date('2026-10-02T09:00:00Z'),
      candidateVisibleNote: 'Estamos a analisar o seu perfil.',
      internalNote: 'NOTA_INTERNA_NUNCA_VISIVEL',
    },
  ],
  new Date('2026-10-24T09:00:00Z'),
);
const originalFetch = global.fetch;
const mockFetch = jest.fn();
const response = (body: unknown, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => body,
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockImplementation(async (url: string) =>
    url.startsWith('/api/profile')
      ? response({ applications: [application] })
      : response(view),
  );
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('renders the real API projection: labels, STP dates, visible notes and silence notice', async () => {
  render(<CandidaturasPage />);
  await screen.findByText('Acompanhamento do processo');
  await screen.findByText('Estamos a analisar o seu perfil.');
  expect(screen.getByText('Recebida')).toBeInTheDocument();
  expect(screen.getByText('1 out. 2026')).toBeInTheDocument();
  expect(screen.getByText('2 out. 2026')).toBeInTheDocument();
  expect(screen.getByText(view.silenceNotice as string)).toBeInTheDocument();
  expect(
    screen.queryByText(/Invalid Date|NOTA_INTERNA_NUNCA_VISIVEL/),
  ).toBeNull();
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/applications/application-1/timeline',
    { headers: { Authorization: 'Bearer synthetic-token' } },
  );
});

test('legacy applications do not request or display the v2 timeline', async () => {
  mockFetch.mockResolvedValue(
    response({
      applications: [{ ...application, v2Status: undefined }],
    }),
  );
  render(<CandidaturasPage />);
  await screen.findByRole('heading', { name: application.jobTitle });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Acompanhamento do processo')).toBeNull();
});

test('candidate notes remain escaped text, never injected HTML', async () => {
  const note = '<img src=x onerror=alert(1)>';
  mockFetch.mockImplementation(async (url: string) =>
    url.startsWith('/api/profile')
      ? response({ applications: [application] })
      : response({
          ...view,
          timeline: [{ label: 'Recebida', date: '1 out. 2026', note }],
        }),
  );
  const { container } = render(<CandidaturasPage />);
  await screen.findByText(note);
  expect(container.querySelector('img')).toBeNull();
});

test('API failure is shown without fabricating timeline entries', async () => {
  mockFetch.mockImplementation(async (url: string) =>
    url.startsWith('/api/profile')
      ? response({ applications: [application] })
      : response(
          { error: { code: 'INTERNAL', message: 'Tente novamente.' } },
          500,
        ),
  );
  render(<CandidaturasPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Tente novamente.',
  );
  expect(screen.queryByText('Recebida')).toBeNull();
});

test('an unmounted card ignores a late timeline response', async () => {
  let resolveTimeline: (value: ReturnType<typeof response>) => void = () =>
    undefined;
  mockFetch.mockImplementation((url: string) =>
    url.startsWith('/api/profile')
      ? Promise.resolve(response({ applications: [application] }))
      : new Promise((resolve) => {
          resolveTimeline = resolve;
        }),
  );
  const { unmount } = render(<CandidaturasPage />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  unmount();
  await act(async () => {
    resolveTimeline(response(view));
  });
  expect(mockPush).not.toHaveBeenCalled();
});

const withdrawalEvent = {
  title: 'Candidatura retirada',
  description: 'Retirou voluntariamente a candidatura.',
  date: '2026-10-24T10:00:00Z',
};
const withdrawnView = buildCandidateApplicationView(
  application.id,
  { ...application, v2Status: 'WITHDRAWN' },
  [{ to: 'WITHDRAWN', at: new Date(withdrawalEvent.date) }],
  new Date(withdrawalEvent.date),
);

async function openWithdrawal() {
  await screen.findByRole('heading', { name: application.jobTitle });
  fireEvent.click(screen.getByRole('button', { name: 'Retirar candidatura' }));
  return screen.getByRole('button', { name: 'Confirmar retirada' });
}

test.each([false, true])(
  'v2 withdrawal updates the badge, removes the action and refreshes timeline (replay=%s)',
  async (alreadyWithdrawn) => {
    let withdrawn = false;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/profile'))
        return response({ applications: [application] });
      if (url.endsWith('/withdraw')) {
        withdrawn = true;
        return response({
          status: 'withdrawn',
          alreadyWithdrawn,
          timelineEvent: alreadyWithdrawn ? null : withdrawalEvent,
        });
      }
      return response(withdrawn ? withdrawnView : view);
    });
    const { container } = render(<CandidaturasPage />);
    await screen.findByText('Estamos a analisar o seu perfil.');
    fireEvent.click(await openWithdrawal());
    await waitFor(() =>
      expect(container.querySelector('.statusPill')).toHaveTextContent(
        'Retirada',
      ),
    );
    expect(
      screen.queryByRole('button', { name: 'Retirar candidatura' }),
    ).toBeNull();
    expect(
      screen.queryByRole('group', { name: 'Retirar esta candidatura?' }),
    ).toBeNull();
    await waitFor(() =>
      expect(
        mockFetch.mock.calls.filter(([url]) =>
          String(url).endsWith('/timeline'),
        ),
      ).toHaveLength(2),
    );
    await waitFor(() =>
      expect(screen.queryByText('Estamos a analisar o seu perfil.')).toBeNull(),
    );
    expect(screen.queryByText(view.silenceNotice as string)).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/applications/application-1/withdraw',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer synthetic-token' },
      },
    );
  },
);

test('legacy withdrawal updates the badge without requesting a v2 timeline', async () => {
  mockFetch.mockImplementation(async (url: string) =>
    url.startsWith('/api/profile')
      ? response({ applications: [{ ...application, v2Status: undefined }] })
      : response({ status: 'withdrawn', timelineEvent: withdrawalEvent }),
  );
  const { container } = render(<CandidaturasPage />);
  fireEvent.click(await openWithdrawal());
  await waitFor(() =>
    expect(container.querySelector('.statusPill')).toHaveTextContent(
      'Retirada',
    ),
  );
  expect(
    screen.queryByRole('button', { name: 'Retirar candidatura' }),
  ).toBeNull();
  expect(
    mockFetch.mock.calls.some(([url]) => String(url).endsWith('/timeline')),
  ).toBe(false);
  expect(screen.getByText('Candidatura retirada')).toBeInTheDocument();
});

test.each([
  [
    {
      error: {
        code: 'CONFLICT',
        message: 'Esta candidatura já está encerrada.',
      },
    },
    'Esta candidatura já está encerrada.',
  ],
  [
    { error: 'Não foi possível retirar a candidatura.' },
    'Não foi possível retirar a candidatura.',
  ],
  [{ error: { code: 'INTERNAL' } }, 'Não foi possível retirar a candidatura.'],
])(
  'failed withdrawal leaves the application unchanged (%j)',
  async (body, message) => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/profile'))
        return response({ applications: [application] });
      return url.endsWith('/withdraw') ? response(body, 409) : response(view);
    });
    const { container } = render(<CandidaturasPage />);
    fireEvent.click(await openWithdrawal());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      message as string,
    );
    expect(container.querySelector('.statusPill')).toHaveTextContent(
      'Em análise',
    );
    expect(
      screen.getByRole('button', { name: 'Confirmar retirada' }),
    ).toBeEnabled();
    expect(screen.queryByText('Candidatura retirada')).toBeNull();
  },
);

test('pending withdrawal disables confirmation and double clicks send one mutation', async () => {
  let resolveWithdrawal: (value: ReturnType<typeof response>) => void = () =>
    undefined;
  mockFetch.mockImplementation((url: string) => {
    if (url.startsWith('/api/profile'))
      return Promise.resolve(response({ applications: [application] }));
    if (url.endsWith('/withdraw'))
      return new Promise((resolve) => {
        resolveWithdrawal = resolve;
      });
    return Promise.resolve(response(view));
  });
  render(<CandidaturasPage />);
  const confirm = await openWithdrawal();
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(confirm).toBeDisabled();
  await waitFor(() =>
    expect(
      mockFetch.mock.calls.filter(([url]) => String(url).endsWith('/withdraw')),
    ).toHaveLength(1),
  );
  await act(async () => {
    resolveWithdrawal(response({ status: 'withdrawn' }));
  });
});

test('withdrawal confirmation explains no reapplication instead of a commercial quota', async () => {
  render(<CandidaturasPage />);
  await openWithdrawal();
  expect(
    screen.getByText(/Não poderá voltar a candidatar-se a esta vaga/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/limite mensal/)).toBeNull();
});

test('cancelling confirmation sends no withdrawal request', async () => {
  render(<CandidaturasPage />);
  await openWithdrawal();
  fireEvent.click(screen.getByRole('button', { name: 'Manter candidatura' }));
  expect(
    screen.queryByRole('group', { name: 'Retirar esta candidatura?' }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Retirar candidatura' }),
  ).toBeEnabled();
  expect(
    mockFetch.mock.calls.some(([url]) => String(url).endsWith('/withdraw')),
  ).toBe(false);
});

test('a pre-withdrawal timeline arriving late cannot overwrite the refreshed history', async () => {
  let timelineReads = 0;
  let resolveOldTimeline: (value: ReturnType<typeof response>) => void = () =>
    undefined;
  mockFetch.mockImplementation((url: string) => {
    if (url.startsWith('/api/profile'))
      return Promise.resolve(response({ applications: [application] }));
    if (url.endsWith('/withdraw'))
      return Promise.resolve(response({ status: 'withdrawn' }));
    timelineReads++;
    return timelineReads === 1
      ? new Promise((resolve) => {
          resolveOldTimeline = resolve;
        })
      : Promise.resolve(response(withdrawnView));
  });
  const { container } = render(<CandidaturasPage />);
  const confirm = await openWithdrawal();
  await waitFor(() => expect(timelineReads).toBe(1));
  fireEvent.click(confirm);
  await screen.findByText('24 out. 2026');
  await act(async () => {
    resolveOldTimeline(response(view));
  });
  expect(container.querySelector('.statusPill')).toHaveTextContent('Retirada');
  expect(screen.queryByText('Estamos a analisar o seu perfil.')).toBeNull();
  expect(screen.queryByText(view.silenceNotice as string)).toBeNull();
  expect(screen.getByText('24 out. 2026')).toBeInTheDocument();
});

test('a failed timeline refresh never undoes a successful withdrawal', async () => {
  let withdrawn = false;
  mockFetch.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/profile'))
      return response({ applications: [application] });
    if (url.endsWith('/withdraw')) {
      withdrawn = true;
      return response({ status: 'withdrawn' });
    }
    return withdrawn
      ? response(
          { error: { message: 'Não foi possível atualizar o histórico.' } },
          500,
        )
      : response(view);
  });
  const { container } = render(<CandidaturasPage />);
  await screen.findByText('Estamos a analisar o seu perfil.');
  fireEvent.click(await openWithdrawal());
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível atualizar o histórico.',
  );
  expect(container.querySelector('.statusPill')).toHaveTextContent('Retirada');
  expect(
    screen.queryByRole('button', { name: 'Retirar candidatura' }),
  ).toBeNull();
  expect(screen.queryByText(view.silenceNotice as string)).toBeNull();
});
