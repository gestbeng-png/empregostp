import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import RecruitmentWorkspace from '@/components/empresa/RecruitmentWorkspace';
import { buildEmployerApplicationView } from '@/domain/applications/employerWorkspace';

const workspace = {
  organizationId: 'org',
  role: 'OWNER',
  userId: 'owner',
  limit: 100,
  capabilities: { manageTeam: true },
  applications: [
    {
      id: 'a',
      jobId: 'j',
      candidateName: 'Ana',
      title: 'Assistente',
      status: 'UNDER_REVIEW',
      permissions: {
        transition: true,
        notes: true,
        cv: true,
        interview: true,
        hire: true,
      },
    },
  ],
  jobs: [],
  interviews: [],
  members: [],
  invitations: [],
  ownershipTransfer: null,
};
const organizations = [
  { organizationId: 'org', role: 'OWNER', name: 'Empresa Alfa' },
  { organizationId: 'other', role: 'ADMIN', name: 'Empresa Beta' },
];
const view = buildEmployerApplicationView({
  applicationId: 'a',
  application: {
    jobId: 'j',
    v2Status: 'UNDER_REVIEW',
    version: 3,
    cvSnapshotKey: 'PRIVATE_STORAGE_KEY',
    candidateSnapshot: {
      fullName: 'Ana',
      contacts: { email: 'ana@example.test' },
      summary: 'Resumo do snapshot',
      birthDate: 'PRIVATE_BIRTH_DATE',
    },
  },
  history: [],
  notes: [],
  internals: { tags: ['excel'] },
  previousApplications: [],
});
let request: jest.Mock;
beforeEach(() => {
  request = jest.fn(async (path: string) => {
    if (path === '/api/me/organizations') return { organizations };
    if (path.startsWith('/api/workspace')) return { organizations, workspace };
    if (path === '/api/applications/a') return view;
    if (path.endsWith('/cv'))
      return {
        url: 'https://storage.test/cv',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      };
    return {};
  });
});
async function open() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ver processo' }));
  await screen.findByText('Resumo do snapshot');
}
test('bootstrap uses one scoped workspace request and does not open applications automatically', async () => {
  render(<RecruitmentWorkspace request={request} />);
  await screen.findByRole('button', { name: 'Ver processo' });
  expect(request).toHaveBeenCalledWith('/api/workspace', expect.anything());
  expect(
    request.mock.calls.some(([path]) => path === '/api/applications/a'),
  ).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
});
test('opened snapshot survives refreshed bootstrap, renders shared contacts and never arbitrary sensitive fields', async () => {
  render(<RecruitmentWorkspace request={request} />);
  await open();
  await waitFor(() =>
    expect(
      request.mock.calls.filter(([path]) => path.startsWith('/api/workspace')),
    ).toHaveLength(2),
  );
  expect(screen.getByText('ana@example.test')).toBeInTheDocument();
  expect(screen.getByText('Resumo do snapshot')).toBeInTheDocument();
  expect(screen.queryByText(/PRIVATE_/)).toBeNull();
});
test('note and review forms call the real routes with typed payloads and retry-safe keys', async () => {
  render(<RecruitmentWorkspace request={request} />);
  await open();
  const note = screen.getByRole('form', { name: 'Adicionar nota interna' });
  fireEvent.change(within(note).getByRole('textbox'), {
    target: { value: 'Nota interna de teste' },
  });
  fireEvent.submit(note);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/applications/a/notes',
      expect.objectContaining({
        method: 'POST',
        body: { body: 'Nota interna de teste' },
        key: expect.stringMatching(/^[a-f0-9]{32}$/),
      }),
    ),
  );
  await waitFor(() => expect(within(note).getByRole('button')).toBeEnabled());
  const review = screen.getByRole('form', {
    name: 'Avaliação e etiquetas internas',
  });
  // Sem escolha, a avaliação não é enviada: nunca se grava uma nota por omissão.
  expect(within(review).getByRole('combobox')).toHaveValue('');
  fireEvent.change(within(review).getByRole('textbox'), {
    target: { value: 'excel, comunicação' },
  });
  fireEvent.submit(review);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/applications/a/review',
      expect.objectContaining({
        method: 'PATCH',
        body: { tags: ['excel', 'comunicação'] },
      }),
    ),
  );
  await waitFor(() => expect(within(review).getByRole('button')).toBeEnabled());
  fireEvent.change(within(review).getByRole('combobox'), {
    target: { value: '4' },
  });
  fireEvent.submit(review);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/applications/a/review',
      expect.objectContaining({
        body: { rating: 4, tags: ['excel', 'comunicação'] },
      }),
    ),
  );
});
test('transition requires explicit confirmation and sends the loaded version, without OFFER/HIRED bypass options', async () => {
  render(<RecruitmentWorkspace request={request} />);
  await open();
  const form = screen.getByRole('form', { name: 'Alterar estado' });
  fireEvent.submit(form);
  expect(
    request.mock.calls.some(([path]) => path.endsWith('/transition')),
  ).toBe(false);
  expect(within(form).queryByRole('option', { name: 'Contratado' })).toBeNull();
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/applications/a/transition',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ expectedVersion: 3 }),
        key: expect.any(String),
      }),
    ),
  );
});
test('CV is fetched only on explicit action, through authenticated signed-link API', async () => {
  render(<RecruitmentWorkspace request={request} />);
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Ver o CV enviado' }));
  expect(
    await screen.findByRole('link', {
      name: 'Abrir CV (ligação válida durante 5 minutos)',
    }),
  ).toHaveAttribute('href', 'https://storage.test/cv');
});
test('bulk preparation locks organization/selection, does not execute automatically, and can be cancelled', async () => {
  request.mockImplementation(async (path: string) => {
    if (path === '/api/me/organizations') return { organizations };
    if (path.startsWith('/api/workspace')) return { organizations, workspace };
    if (path === '/api/bulk-actions')
      return {
        bulkId: 'bulk',
        count: 1,
        confirmationText: 'Confirmar 1 candidatura',
        executeAfter: new Date(Date.now() + 10_000).toISOString(),
      };
    return {};
  });
  render(<RecruitmentWorkspace request={request} />);
  const select = await screen.findByRole('checkbox', {
    name: 'Selecionar candidatura de Ana',
  });
  fireEvent.click(select);
  fireEvent.submit(screen.getByRole('form', { name: 'Preparar ação em lote' }));
  await screen.findByText('Confirmar 1 candidatura');
  expect(select).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Organização' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Confirmar execução' }),
  ).toBeDisabled();
  expect(request.mock.calls.some(([path]) => path.endsWith('/execute'))).toBe(
    false,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer ação' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/bulk-actions/bulk/cancel',
      expect.objectContaining({ method: 'POST' }),
    ),
  );
  await waitFor(() => expect(select).toBeEnabled());
});
test('empty membership shows a usable message, without unscoped workspace reads', async () => {
  request.mockResolvedValue({ organizations: [] });
  render(<RecruitmentWorkspace request={request} />);
  await screen.findByText(/ainda não pertence a uma organização/i);
  expect(request).toHaveBeenCalledTimes(1);
});
test('late bootstrap after unmount is ignored', async () => {
  let resolve: (value: unknown) => void = () => undefined;
  request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { unmount } = render(<RecruitmentWorkspace request={request} />);
  unmount();
  await act(async () => resolve({ organizations: [] }));
});

test.each([
  [
    'Resultado do processo',
    '/api/jobs/j/close',
    {},
    { closeOutcome: 'HIRED_VIA_EMPREGOSTP' },
  ],
  ['Confirmar vaga preenchida', '/api/jobs/j/fill', {}, {}],
  [
    'Convidar membro',
    '/api/organizations/org/invitations',
    { email: 'new@example.test' },
    { email: 'new@example.test', role: 'ADMIN' },
  ],
  [
    'Revogar convite para invited@example.test',
    '/api/invitations/inv/revoke',
    {},
    {},
  ],
  [
    'Alterar papel do membro',
    '/api/organizations/org/members/admin',
    { role: 'RECRUITER' },
    { role: 'RECRUITER' },
  ],
  [
    'Remover membro',
    '/api/organizations/org/members/admin',
    {},
    { remove: true },
  ],
  [
    'Propor transferência de propriedade',
    '/api/organizations/org/ownership-transfer',
    {},
    { targetUserId: 'admin' },
  ],
  [
    'Aceitar propriedade da organização',
    '/api/organizations/org/ownership-transfer/accept',
    {},
    {},
  ],
] as const)(
  'connects %s with explicit submission and confirmation',
  async (title, path, values, body) => {
    const activeWorkspace = {
      ...workspace,
      jobs: [
        {
          id: 'j',
          title: 'Assistente',
          status: 'EXPIRED',
          canClose: true,
          fillProposed: true,
          closingPending: true,
        },
      ],
      members: [
        { userId: 'owner', role: 'OWNER' },
        { userId: 'admin', role: 'ADMIN' },
      ],
      invitations: [
        { id: 'inv', email: 'invited@example.test', role: 'RECRUITER' },
      ],
      ownershipTransfer: { canAccept: true },
    };
    request.mockImplementation(async (url: string) =>
      url === '/api/me/organizations'
        ? { organizations }
        : url.startsWith('/api/workspace')
          ? { organizations, workspace: activeWorkspace }
          : {},
    );
    render(<RecruitmentWorkspace request={request} />);
    fireEvent.click(
      await screen.findByRole('tab', {
        name: path.startsWith('/api/jobs/') ? /Vagas/ : /Equipa/,
      }),
    );
    const form = await screen.findByRole('form', { name: title });
    for (const [key, value] of Object.entries(values)) {
      const input = form.querySelector(`[name="${key}"]`);
      if (!input) throw new Error(`Missing form field ${key}`);
      fireEvent.change(input, { target: { value } });
    }
    const confirm = within(form).queryByRole('checkbox');
    if (confirm) fireEvent.click(confirm);
    fireEvent.submit(form);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        path,
        expect.objectContaining({
          body: expect.objectContaining(body),
          key: expect.any(String),
        }),
      ),
    );
  },
);
test('closing message preview is separate from confirmation and sends exactly the previewed template', async () => {
  request.mockImplementation(async (path: string) => {
    if (path === '/api/me/organizations') return { organizations };
    if (path.startsWith('/api/workspace'))
      return {
        organizations,
        workspace: {
          ...workspace,
          jobs: [
            {
              id: 'j',
              title: 'Assistente',
              status: 'CLOSED',
              canClose: true,
              closingPending: true,
            },
          ],
        },
      };
    return {
      preview: 'Ana, o processo terminou.',
      template: '{nome}, o processo terminou.',
    };
  });
  render(<RecruitmentWorkspace request={request} />);
  fireEvent.click(await screen.findByRole('tab', { name: /Vagas/ }));
  fireEvent.submit(
    await screen.findByRole('form', {
      name: 'Mensagem de fecho aos candidatos',
    }),
  );
  await screen.findByText('Ana, o processo terminou.');
  expect(request).toHaveBeenCalledWith(
    '/api/jobs/j/closing-message',
    expect.objectContaining({ body: { confirm: false } }),
  );
  expect(
    request.mock.calls.filter(([path]) => path.endsWith('/closing-message')),
  ).toHaveLength(1);
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar esta mensagem de fecho' }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/jobs/j/closing-message',
      expect.objectContaining({
        body: { confirm: true, message: '{nome}, o processo terminou.' },
      }),
    ),
  );
});
test('message templates are loaded explicitly and saved through PATCH, not during bootstrap', async () => {
  request.mockImplementation(async (path: string) =>
    path === '/api/me/organizations'
      ? { organizations }
      : path.startsWith('/api/workspace')
        ? { organizations, workspace }
        : {
            NOT_SELECTED: 'Olá {nome}, obrigado.',
            PROCESS_CLOSED: 'Olá {nome}, terminou.',
          },
  );
  render(<RecruitmentWorkspace request={request} />);
  fireEvent.click(await screen.findByRole('tab', { name: /Mensagens/ }));
  const button = await screen.findByRole('button', {
    name: 'Editar modelos de mensagens',
  });
  expect(
    request.mock.calls.some(([path]) => path.endsWith('/message-templates')),
  ).toBe(false);
  fireEvent.click(button);
  const form = await screen.findByRole('form', {
    name: 'Modelos de mensagens',
  });
  fireEvent.submit(form);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/organizations/org/message-templates',
      expect.objectContaining({
        method: 'PATCH',
        body: {
          NOT_SELECTED: 'Olá {nome}, obrigado.',
          PROCESS_CLOSED: 'Olá {nome}, terminou.',
        },
      }),
    ),
  );
});

test('tabs separate the workflow, organization labels are human-readable and searching is local', async () => {
  render(<RecruitmentWorkspace request={request} />);
  await screen.findByRole('button', { name: 'Ver processo' });
  expect(
    screen.getByRole('option', { name: /Empresa Alfa/ }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Convidar membro' })).toBeNull();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Procurar candidato ou vaga' }),
    { target: { value: 'missing' } },
  );
  expect(screen.queryByRole('button', { name: 'Ver processo' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(
    screen.getByRole('button', { name: 'Ver processo' }),
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('tab', { name: /Equipa/ }));
  expect(screen.queryByRole('button', { name: 'Ver processo' })).toBeNull();
  expect(
    screen.getByRole('form', { name: 'Convidar membro' }),
  ).toBeInTheDocument();
});

test('pending links are recovered only explicitly and manual sharing is honest about email delivery', async () => {
  request.mockImplementation(async (path: string) =>
    path.startsWith('/api/workspace')
      ? {
          organizations,
          workspace: {
            ...workspace,
            team: {
              inviteConfigured: true,
              emailProcessorEnabled: false,
              seatLimit: 2,
              usedSeats: 2,
            },
            invitations: [
              {
                id: 'inv',
                email: 'ana@example.test',
                role: 'RECRUITER',
                expiresAt: '2030-01-01T00:00:00Z',
              },
            ],
          },
        }
      : { acceptPath: '/equipa/convite?i=inv&t=synthetic-token' },
  );
  render(<RecruitmentWorkspace request={request} />);
  fireEvent.click(await screen.findByRole('tab', { name: /Equipa/ }));
  expect(
    screen.getByText(/envio automático de emails está desligado/),
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Criar convite' })).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Obter ligação do convite' }),
  );
  const link = await screen.findByRole('textbox', {
    name: 'Ligação para ana@example.test',
  });
  expect(link).toHaveValue(
    'http://localhost/equipa/convite?i=inv&t=synthetic-token',
  );
  expect(request).toHaveBeenCalledWith(
    '/api/invitations/inv',
    expect.anything(),
  );
});

test('switching organizations clears the selected application and does not carry invitation links across tenants', async () => {
  const onContextChange = jest.fn();
  render(
    <RecruitmentWorkspace
      request={request}
      onContextChange={onContextChange}
    />,
  );
  await open();
  fireEvent.change(screen.getByRole('combobox', { name: 'Organização' }), {
    target: { value: 'other' },
  });
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/workspace?organizationId=other',
      expect.anything(),
    ),
  );
  expect(screen.queryByText('Resumo do snapshot')).toBeNull();
  expect(onContextChange).toHaveBeenCalledWith(
    expect.objectContaining({ organizationId: 'other', applicationId: '' }),
  );
});

test('a recruiter cannot navigate into team management or message templates', async () => {
  request.mockResolvedValue({
    organizations,
    workspace: {
      ...workspace,
      role: 'RECRUITER',
      capabilities: { ...workspace.capabilities, manageTeam: false },
    },
  });
  render(<RecruitmentWorkspace request={request} />);
  await screen.findByRole('button', { name: 'Ver processo' });
  expect(screen.queryByRole('tab', { name: /Equipa/ })).toBeNull();
  expect(screen.queryByRole('tab', { name: /Mensagens/ })).toBeNull();
});

test('executing a bulk action releases navigation even when selection removes the action panel', async () => {
  request.mockImplementation(async (path: string) =>
    path.startsWith('/api/workspace')
      ? { organizations, workspace }
      : path === '/api/bulk-actions'
        ? {
            bulkId: 'bulk',
            count: 1,
            confirmationText: 'Pronto para executar',
            executeAfter: new Date(Date.now() - 1000).toISOString(),
          }
        : { updated: 1, failed: 0 },
  );
  render(<RecruitmentWorkspace request={request} />);
  fireEvent.click(
    await screen.findByRole('checkbox', {
      name: 'Selecionar candidatura de Ana',
    }),
  );
  fireEvent.submit(screen.getByRole('form', { name: 'Preparar ação em lote' }));
  await screen.findByText('Pronto para executar');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar execução' }));
  await screen.findByText('1 atualizadas; 0 não alteradas.');
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Equipa/ })).toBeEnabled(),
  );
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Organização' })).toBeEnabled(),
  );
});
