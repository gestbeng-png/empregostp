import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';

import RecruitmentWorkspace from '@/components/empresa/RecruitmentWorkspace';

/** Synthetic-only component preview. No accounts, database connections or email sends. */
test('realistic recruitment/team presentation stays connected to scoped actions', async () => {
  const workspace = {
    organizationId: 'synthetic-org',
    userId: 'synthetic-owner',
    role: 'OWNER',
    limit: 100,
    capabilities: { ats: true, jobs: true, interviews: true, manageTeam: true },
    applications: [
      {
        id: 'ana',
        jobId: 'assistant',
        candidateName: 'Ana Silva',
        title: 'Assistente administrativa',
        status: 'SUBMITTED',
        permissions: { transition: true },
      },
      {
        id: 'manuel',
        jobId: 'accountant',
        candidateName: 'Manuel Costa',
        title: 'Técnico de contabilidade',
        status: 'UNDER_REVIEW',
        permissions: { transition: true },
      },
      {
        id: 'rita',
        jobId: 'assistant',
        candidateName: 'Rita Fernandes',
        title: 'Assistente administrativa',
        status: 'INTERVIEW',
        permissions: { transition: true },
      },
    ],
    jobs: [
      {
        id: 'assistant',
        title: 'Assistente administrativa',
        status: 'PUBLISHED',
        canClose: true,
      },
      {
        id: 'accountant',
        title: 'Técnico de contabilidade',
        status: 'PUBLISHED',
        canClose: true,
      },
    ],
    interviews: [],
    members: [
      {
        userId: 'synthetic-owner',
        name: 'Carlos Santos',
        email: 'carlos@example.test',
        role: 'OWNER',
      },
      {
        userId: 'synthetic-admin',
        name: 'Maria Sousa',
        email: 'maria@example.test',
        role: 'ADMIN',
      },
    ],
    invitations: [
      {
        id: 'synthetic-invitation',
        email: 'ana@example.test',
        role: 'RECRUITER',
        expiresAt: '2030-10-17T10:00:00Z',
      },
    ],
    team: {
      inviteConfigured: true,
      emailProcessorEnabled: false,
      seatLimit: 5,
      usedSeats: 3,
    },
    ownershipTransfer: null,
  };
  const request = jest.fn(async () => ({
    organizations: [
      {
        organizationId: workspace.organizationId,
        name: 'Ilha Verde Serviços',
        role: 'OWNER',
      },
    ],
    workspace,
  }));
  const { container } = render(<RecruitmentWorkspace request={request} />);
  await screen.findByText('Ana Silva');
  const exportDir = process.env.RECRUITMENT_VISUAL_EXPORT_DIR;
  const capture = (name: string) => {
    if (
      !exportDir ||
      !exportDir.startsWith('/private/tmp/empregostp-recruitment-qa.')
    )
      return;
    const moduleCss = readFileSync(
      join(process.cwd(), 'styles/RecruitmentWorkspace.module.css'),
      'utf8',
    );
    const classes = new Set(
      [...moduleCss.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => match[1]),
    );
    const markup = container.innerHTML.replace(
      /class="([^"]*)"/g,
      (_match, names: string) =>
        `class="${names
          .split(' ')
          .map((name) => (classes.has(name) ? 'rq-' + name : name))
          .join(' ')}"`,
    );
    const css =
      [
        'styles/globals.css',
        'styles/workbridge-theme.css',
        'styles/dashboard-shell.css',
      ]
        .map((file) => readFileSync(join(process.cwd(), file), 'utf8'))
        .join('\n') +
      '\n' +
      moduleCss.replace(/\.([a-zA-Z_][\w-]*)/g, '.rq-$1');
    const fonts = [400, 500, 600, 700]
      .map(
        (weight) =>
          `@font-face{font-family:'Instrument Sans';font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(join(process.cwd(), `public/fonts/instrument-sans-${weight}.ttf`)).toString('base64')})}`,
      )
      .join('\n');
    writeFileSync(
      join(exportDir, name + '.html'),
      `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${fonts}\nbody{margin:0}.qa{display:block;padding:24px;min-height:100vh}.qa>.rq-root{max-width:1180px;margin:auto}.qa h1{font-size:32px}.qa input,.qa select{box-sizing:border-box}@media(max-width:500px){.qa{padding:16px}.qa h1{font-size:26px}}</style><body><main class="workbridgeRoute dashShell qa">${markup}</main></body></html>`,
    );
  };
  capture('applications');
  fireEvent.click(screen.getByRole('tab', { name: /Vagas/ }));
  const firstJob = screen.getAllByRole('button', {
    name: 'Ver candidaturas',
  })[0];
  if (!firstJob) throw new Error('Missing job action');
  fireEvent.click(firstJob);
  expect(screen.getByText('Ana Silva')).toBeInTheDocument();
  expect(screen.queryByText('Manuel Costa')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /Equipa/ }));
  expect(screen.getByText('Carlos Santos')).toBeInTheDocument();
  expect(
    screen.getByText(/envio automático de emails está desligado/),
  ).toBeInTheDocument();
  capture('team');
  expect(request).toHaveBeenCalledTimes(1);
});
