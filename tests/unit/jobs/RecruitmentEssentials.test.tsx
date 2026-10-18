import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import RecruitmentWorkspace from '@/components/empresa/RecruitmentWorkspace';

const perm = {
  transition: true,
  notes: true,
  cv: true,
  interview: true,
  hire: true,
};
const workspace = {
  organizationId: 'org',
  role: 'OWNER',
  userId: 'org',
  limit: 100,
  capabilities: { manageTeam: true },
  applications: [
    {
      id: 'a',
      jobId: 'j1',
      candidateName: 'Ana Neto',
      title: 'Contabilista',
      status: 'SUBMITTED',
      isNew: true,
      isStale: false,
      assigneeUserId: 'rec',
      assigneeName: 'Rita Ramos',
      permissions: perm,
    },
    {
      id: 'b',
      jobId: 'j1',
      candidateName: 'Bruno Costa',
      title: 'Contabilista',
      status: 'UNDER_REVIEW',
      isNew: false,
      isStale: true,
      permissions: perm,
    },
    {
      id: 'c',
      jobId: 'j1',
      candidateName: 'Carla Lima',
      title: 'Contabilista',
      status: 'OFFER',
      isNew: false,
      isStale: false,
      permissions: perm,
    },
  ],
  jobs: [
    {
      id: 'j1',
      title: 'Contabilista',
      status: 'PUBLISHED',
      canClose: true,
      fillProposed: false,
      closingPending: false,
      applicationDeadline: null,
      closingSummary: {
        open: 3,
        inReview: 2,
        interview: 0,
        offer: 1,
        hasActiveOffer: true,
      },
      hiringTeam: {
        version: 2,
        leadRecruiterId: 'rec',
        hiringManagerId: null,
        members: [
          { userId: 'rec', role: 'LEAD_RECRUITER', name: 'Rita Ramos' },
        ],
        canManage: true,
      },
    },
  ],
  interviews: [],
  members: [],
  invitations: [],
  ownershipTransfer: null,
  teamCandidates: [
    { userId: 'org', name: 'Empresa Alfa', role: 'OWNER' },
    { userId: 'rec', name: 'Rita Ramos', role: 'RECRUITER' },
    { userId: 'dir', name: 'Diogo Reis', role: 'REVIEWER' },
  ],
  overview: {
    metrics: {
      openJobs: 1,
      newApplications: 1,
      toReview: 2,
      upcomingInterviews: 0,
      pendingOffers: 1,
      hiresInPeriod: 0,
      avgDaysToFirstReview: 1.5,
    },
    attention: [
      {
        key: 'NEW_APPLICATIONS',
        count: 1,
        label: '1 candidatura nova por abrir',
        section: 'applications',
        filter: 'new',
      },
      {
        key: 'STALE_APPLICATIONS',
        count: 1,
        label: '1 candidatura sem análise há mais de 10 dias',
        section: 'applications',
        filter: 'stale',
      },
    ],
  },
};
let request: jest.Mock;
beforeEach(() => {
  request = jest.fn(async (path: string) =>
    path.startsWith('/api/workspace')
      ? {
          organizations: [
            { organizationId: 'org', role: 'OWNER', name: 'Empresa Alfa' },
          ],
          workspace,
        }
      : { version: 3 },
  );
});

test('R16: métricas reais e «Precisa da sua atenção» levam à lista filtrada', async () => {
  render(<RecruitmentWorkspace request={request} />);
  expect(await screen.findByText('Precisa da sua atenção')).toBeInTheDocument();
  expect(screen.getByText(/1,5 dias/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: /sem análise há mais de 10 dias/ }),
  );
  const chips = screen.getByRole('group', { name: 'Mostrar' });
  expect(
    within(chips).getByRole('button', { name: /Paradas há mais de 10 dias/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Bruno Costa')).toBeInTheDocument();
  expect(screen.queryByText('Ana Neto')).toBeNull();
  fireEvent.click(within(chips).getByRole('button', { name: /^Novas/ }));
  expect(screen.getByText('Ana Neto')).toBeInTheDocument();
  expect(screen.queryByText('Bruno Costa')).toBeNull();
});

test('R14/R15: equipa da vaga mostra o responsável e guarda com a versão lida', async () => {
  render(<RecruitmentWorkspace request={request} initialSection="jobs" />);
  expect(await screen.findByText('Rita Ramos')).toBeInTheDocument();
  expect(
    screen.getByText('Hiring Manager').nextElementSibling,
  ).toHaveTextContent('Não definido');
  const form = screen.getByRole('form', { name: 'Equipa deste recrutamento' });
  fireEvent.change(within(form).getByLabelText(/Hiring Manager/), {
    target: { value: 'dir' },
  });
  fireEvent.submit(form);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/jobs/j1/hiring-team',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({
          leadRecruiterId: 'rec',
          hiringManagerId: 'dir',
          expectedVersion: 2,
        }),
      }),
    ),
  );
});

test('R91: antes de fechar mostra o que fica por resolver e avisa da proposta ativa', async () => {
  render(<RecruitmentWorkspace request={request} initialSection="jobs" />);
  expect(
    await screen.findByText(/3 candidaturas ficam por resolver/),
  ).toBeInTheDocument();
  expect(screen.getByText(/2 em análise, 1 com proposta/)).toBeInTheDocument();
  expect(screen.getByText(/Há uma proposta ativa/)).toBeInTheDocument();
});

test('R24: filtro «Sem responsável» e atribuição em lote a partir da seleção', async () => {
  render(<RecruitmentWorkspace request={request} />);
  const chips = await screen.findByRole('group', { name: 'Mostrar' });
  expect(screen.getByText(/Responsável: Rita Ramos/)).toBeInTheDocument();
  fireEvent.click(
    within(chips).getByRole('button', { name: /Sem responsável/ }),
  );
  expect(screen.queryByText('Ana Neto')).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: /Bruno Costa/ }));
  const form = screen.getByRole('form', { name: /Atribuir 1 candidatura/ });
  fireEvent.change(within(form).getByLabelText('Pessoa da equipa'), {
    target: { value: 'dir' },
  });
  fireEvent.submit(form);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/applications/assignments',
      expect.objectContaining({
        method: 'POST',
        body: {
          organizationId: 'org',
          applicationIds: ['b'],
          assigneeUserId: 'dir',
        },
      }),
    ),
  );
});

test('R57: remover quem tem processos a cargo exige escolher quem os recebe', async () => {
  const withMembers = {
    ...workspace,
    team: {
      inviteConfigured: true,
      emailProcessorEnabled: true,
      usedSeats: 3,
      seatLimit: 5,
    },
    members: [
      {
        userId: 'org',
        role: 'OWNER',
        name: 'Empresa Alfa',
        email: 'rh@alfa.st',
        assignedJobIds: [],
        responsibilities: {
          leadJobs: 0,
          supportJobs: 0,
          applications: 0,
          interviews: 0,
          mustTransfer: false,
        },
      },
      {
        userId: 'rec',
        role: 'RECRUITER',
        name: 'Rita Ramos',
        email: 'rita@alfa.st',
        assignedJobIds: [],
        responsibilities: {
          leadJobs: 1,
          supportJobs: 0,
          applications: 4,
          interviews: 1,
          mustTransfer: true,
        },
      },
      {
        userId: 'adm',
        role: 'ADMIN',
        name: 'Abel Dias',
        email: 'abel@alfa.st',
        assignedJobIds: [],
        responsibilities: {
          leadJobs: 0,
          supportJobs: 0,
          applications: 0,
          interviews: 0,
          mustTransfer: false,
        },
      },
    ],
  };
  request.mockImplementation(async (path: string) =>
    path.startsWith('/api/workspace')
      ? {
          organizations: [
            { organizationId: 'org', role: 'OWNER', name: 'Empresa Alfa' },
          ],
          workspace: withMembers,
        }
      : { removed: true },
  );
  render(<RecruitmentWorkspace request={request} initialSection="team" />);
  expect(await screen.findByText('Responsável por 1 vaga')).toBeInTheDocument();
  expect(screen.getByText('4 candidaturas atribuídas')).toBeInTheDocument();
  const forms = screen.getAllByRole('form', { name: 'Remover membro' });
  const form = forms.find((item) =>
    within(item).queryByLabelText('Quem fica com estas responsabilidades'),
  );
  if (!form) throw new Error('missing transfer field');
  const select = within(form).getByLabelText(
    'Quem fica com estas responsabilidades',
  );
  expect(select).toBeRequired();
  fireEvent.change(select, { target: { value: 'adm' } });
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/organizations/org/members/rec',
      expect.objectContaining({
        method: 'PATCH',
        body: { remove: true, transferToUserId: 'adm' },
      }),
    ),
  );
});
