import { render, screen } from '@testing-library/react';

import AdminJobDetail from '../../../pages/dashboard/admin/jobs/[id]';

jest.mock('../../../lib/firebase', () => ({
  auth: { currentUser: null },
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {},
}));

const application = {
  candidateEmail: 'candidato@example.com',
  candidateId: 'candidate-1',
  candidateName: 'Candidato STP',
  createdAt: '2026-08-01T10:00:00.000Z',
  id: 'application-1',
  status: 'pending',
};

const job = {
  adminPublished: true,
  companyName: 'Empresa Parceira',
  descricao: 'Descrição da vaga',
  id: 'job-1',
  status: 'active',
  titulo: 'Gestor de Projetos',
};

describe('candidaturas de vagas publicadas pelo Admin', () => {
  test('apresenta controlo de estado e perfil administrativo do candidato', () => {
    render(
      <AdminJobDetail
        applications={[application]}
        company={null}
        job={job}
      />,
    );

    expect(
      screen.getByLabelText('Estado da candidatura de Candidato STP'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar estado' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Ver perfil' })).toHaveAttribute(
      'href',
      '/dashboard/admin/users/candidate-1',
    );
  });

  test('não mostra o controlo em vagas que não foram publicadas pelo Admin', () => {
    render(
      <AdminJobDetail
        applications={[application]}
        company={null}
        job={{ ...job, adminPublished: false }}
      />,
    );

    expect(
      screen.queryByLabelText('Estado da candidatura de Candidato STP'),
    ).not.toBeInTheDocument();
  });
});
