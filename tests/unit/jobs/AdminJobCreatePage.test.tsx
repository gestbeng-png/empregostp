import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getDownloadURL, uploadBytes } from 'firebase/storage';

import AdminJobCreate from '../../../pages/dashboard/admin/jobs/create';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {},
}));

jest.mock('../../../lib/firebase', () => ({
  auth: { currentUser: { uid: 'admin-1' } },
  storage: {},
}));

jest.mock('firebase/storage', () => ({
  getDownloadURL: jest.fn().mockResolvedValue('https://files.example/tdr.pdf'),
  ref: jest.fn(() => 'tdr-storage-ref'),
  uploadBytes: jest.fn().mockResolvedValue(undefined),
}));

describe('formulário administrativo de criação de vagas', () => {
  test('permite informar manualmente a empresa e o nome da vaga', () => {
    render(
      <AdminJobCreate
        companies={[{ id: 'company-1', name: 'Empresa Cadastrada' }]}
      />,
    );

    expect(screen.getByLabelText('Selecionar empresa')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Outros' })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('radio', { name: /empresa não cadastrada/i }),
    );

    const companyName = screen.getByLabelText('Nome da empresa *');
    const jobTitle = screen.getByLabelText('Título / nome da vaga *');

    fireEvent.change(companyName, {
      target: { value: 'Empresa Parceira STP' },
    });
    fireEvent.change(jobTitle, {
      target: { value: 'Técnico de Operações' },
    });

    expect(companyName).toHaveValue('Empresa Parceira STP');
    expect(jobTitle).toHaveValue('Técnico de Operações');
    expect(
      screen.getByText(/sem criar uma conta empresarial/i),
    ).toBeInTheDocument();
  });

  test('recolhe requisitos, benefícios e permite anexar o TDR', async () => {
    render(
      <AdminJobCreate
        companies={[{ id: 'company-1', name: 'Empresa Cadastrada' }]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Selecionar empresa'), {
      target: { value: 'company-1' },
    });
    fireEvent.change(screen.getByLabelText('Título / nome da vaga *'), {
      target: { value: 'Gestor de Projetos' },
    });
    fireEvent.change(screen.getByLabelText('Categoria *'), {
      target: { value: 'Gestão e Administração' },
    });
    fireEvent.change(screen.getByLabelText('Descrição *'), {
      target: { value: 'Coordenação de projetos institucionais.' },
    });
    fireEvent.change(screen.getByLabelText('Requisitos *'), {
      target: { value: 'Licenciatura e três anos de experiência.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    const benefits = screen.getByLabelText('Benefícios');
    fireEvent.change(benefits, {
      target: { value: 'Seguro de saúde e formação.' },
    });
    fireEvent.change(screen.getByLabelText('Localização *'), {
      target: { value: 'São Tomé' },
    });
    fireEvent.change(screen.getByLabelText('Tipo de contrato *'), {
      target: { value: 'Tempo Integral' },
    });
    expect(benefits).toHaveValue('Seguro de saúde e formação.');

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    const tdrInput = screen.getByLabelText('Carregar ficheiro TDR');
    const tdrFile = new File(
      ['conteúdo do documento'],
      'termos-referencia.pdf',
      {
        type: 'application/pdf',
      },
    );
    fireEvent.change(tdrInput, { target: { files: [tdrFile] } });

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getDownloadURL).toHaveBeenCalledWith('tdr-storage-ref'),
    );
    expect(
      await screen.findByText('termos-referencia.pdf'),
    ).toBeInTheDocument();
  });

  test('valida o intervalo salarial em STN antes de avançar', () => {
    render(
      <AdminJobCreate
        companies={[{ id: 'company-1', name: 'Empresa Cadastrada' }]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Selecionar empresa'), {
      target: { value: 'company-1' },
    });
    fireEvent.change(screen.getByLabelText('Título / nome da vaga *'), {
      target: { value: 'Gestor Financeiro' },
    });
    fireEvent.change(screen.getByLabelText('Categoria *'), {
      target: { value: 'Finanças' },
    });
    fireEvent.change(screen.getByLabelText('Descrição *'), {
      target: { value: 'Gestão financeira da operação.' },
    });
    fireEvent.change(screen.getByLabelText('Requisitos *'), {
      target: { value: 'Licenciatura e experiência comprovada.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    fireEvent.change(screen.getByLabelText('Localização *'), {
      target: { value: 'São Tomé' },
    });
    fireEvent.change(screen.getByLabelText('Tipo de contrato *'), {
      target: { value: 'Tempo Integral' },
    });
    fireEvent.change(screen.getByLabelText('Salário mínimo (STN)'), {
      target: { value: '9000' },
    });
    fireEvent.change(screen.getByLabelText('Salário máximo (STN)'), {
      target: { value: '6000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O salário máximo não pode ser inferior ao salário mínimo',
    );
    expect(screen.getByLabelText('Salário mínimo (STN)')).toBeVisible();
  });
});
