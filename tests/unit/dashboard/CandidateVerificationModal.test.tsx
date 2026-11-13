import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import CandidateVerificationModal from '../../../components/candidates/CandidateVerificationModal';

const profile = {
  email: 'candidate@example.com',
  phone: '9900000',
  cvUrl: 'https://example.com/cv.pdf',
  education: '',
};
const details = {
  skills: 'Desenvolvimento de aplicações web, testes e bases de dados.',
  experience:
    'Trabalho com desenvolvimento e gestão de projetos há mais de cinco anos.',
};

test('abre duas opções e encaminha a escolha Premium para os planos', async () => {
  const onPremium = jest.fn();
  render(
    <CandidateVerificationModal
      profile={profile}
      onClose={jest.fn()}
      onPremium={onPremium}
      onSubmit={jest.fn()}
    />,
  );
  expect(
    screen.getByRole('dialog', { name: 'Como quer verificar o seu perfil?' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: /Provar as minhas competências/ }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole('button', { name: /Tornar-me verificado com Premium/ }),
  );
  expect(onPremium).toHaveBeenCalledTimes(1);
});

test('quem já tem verificação incluída pode enviar documentos sem voltar a comprar um plano', async () => {
  const onPremium = jest.fn();
  render(
    <CandidateVerificationModal
      profile={profile}
      verificationIncluded
      onClose={jest.fn()}
      onPremium={onPremium}
      onSubmit={jest.fn()}
    />,
  );

  expect(screen.getByText('Incluído no seu plano')).toBeVisible();
  expect(screen.getByText(/sem pagamento adicional/)).toBeVisible();
  expect(screen.queryByText('Ver planos →')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /Provar as minhas competências/ }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole('button', { name: /Usar a verificação do meu plano/ }),
  );
  expect(onPremium).toHaveBeenCalledTimes(1);
});

async function fillForm() {
  await userEvent.click(
    screen.getByRole('button', { name: /Provar as minhas competências/ }),
  );
  await userEvent.type(
    screen.getByLabelText('Competências e exemplos de trabalhos'),
    details.skills,
  );
  await userEvent.type(
    screen.getByLabelText('Experiência profissional e projetos'),
    details.experience,
  );
  await userEvent.type(
    screen.getByLabelText('Link de prova 1'),
    'https://example.com/portfolio',
  );
}

test('envia as informações para análise e fecha apenas depois de guardar', async () => {
  const onSubmit = jest.fn().mockResolvedValue({});
  const onClose = jest.fn();
  render(
    <CandidateVerificationModal
      profile={profile}
      onClose={onClose}
      onPremium={jest.fn()}
      onSubmit={onSubmit}
    />,
  );
  await fillForm();
  await userEvent.click(
    screen.getByRole('button', { name: 'Enviar para análise' }),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      skills: details.skills,
      experience: details.experience,
      email: profile.email,
      links: [{ url: 'https://example.com/portfolio', description: '' }],
    }),
  );
});

test('uma falha preserva as informações e permite tentar novamente', async () => {
  const onSubmit = jest
    .fn()
    .mockRejectedValue(new Error('Ligação indisponível.'));
  const onClose = jest.fn();
  render(
    <CandidateVerificationModal
      profile={profile}
      onClose={onClose}
      onPremium={jest.fn()}
      onSubmit={onSubmit}
    />,
  );
  await fillForm();
  await userEvent.click(
    screen.getByRole('button', { name: 'Enviar para análise' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ligação indisponível.',
  );
  expect(
    screen.getByLabelText('Competências e exemplos de trabalhos'),
  ).toHaveValue(details.skills);
  expect(screen.getByLabelText('Link de prova 1')).toHaveValue(
    'https://example.com/portfolio',
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Enviar para análise' }),
  ).toBeEnabled();
});

test('exige um comprovativo ou link antes de enviar', async () => {
  const onSubmit = jest.fn();
  render(
    <CandidateVerificationModal
      profile={profile}
      onClose={jest.fn()}
      onPremium={jest.fn()}
      onSubmit={onSubmit}
    />,
  );
  await userEvent.click(
    screen.getByRole('button', { name: /Provar as minhas competências/ }),
  );
  await userEvent.type(
    screen.getByLabelText('Competências e exemplos de trabalhos'),
    details.skills,
  );
  await userEvent.type(
    screen.getByLabelText('Experiência profissional e projetos'),
    details.experience,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Enviar para análise' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Inclua um link profissional',
  );
  expect(onSubmit).not.toHaveBeenCalled();
});

test('envia vários links com a descrição antes de cada um e remove apenas a prova escolhida', async () => {
  const onSubmit = jest.fn().mockResolvedValue({});
  render(
    <CandidateVerificationModal
      profile={profile}
      onClose={jest.fn()}
      onPremium={jest.fn()}
      onSubmit={onSubmit}
    />,
  );
  await fillForm();
  await userEvent.type(
    screen.getByLabelText('Breve descrição do link 1 (opcional)'),
    'Portefólio de aplicações que desenvolvi.',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar link' }));
  expect(
    screen.getByLabelText('Breve descrição do link 2 (opcional)'),
  ).toHaveFocus();
  await userEvent.type(
    screen.getByLabelText('Breve descrição do link 2 (opcional)'),
    'Prova a remover',
  );
  await userEvent.type(
    screen.getByLabelText('Link de prova 2'),
    'https://example.com/remover',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar link' }));
  await userEvent.type(
    screen.getByLabelText('Breve descrição do link 3 (opcional)'),
    'Demonstração de um projeto de gestão.',
  );
  await userEvent.type(
    screen.getByLabelText('Link de prova 3'),
    'https://example.com/projeto',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Remover link 2' }));
  expect(screen.getAllByLabelText(/Link de prova \d/)).toHaveLength(2);
  expect(
    screen.getByLabelText('Breve descrição do link 2 (opcional)'),
  ).toHaveValue('Demonstração de um projeto de gestão.');
  await userEvent.click(
    screen.getByRole('button', { name: 'Enviar para análise' }),
  );
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      links: [
        {
          url: 'https://example.com/portfolio',
          description: 'Portefólio de aplicações que desenvolvi.',
        },
        {
          url: 'https://example.com/projeto',
          description: 'Demonstração de um projeto de gestão.',
        },
      ],
    }),
  );
});

test('não perde uma descrição que ficou sem link', async () => {
  const onSubmit = jest.fn();
  render(
    <CandidateVerificationModal
      profile={profile}
      onClose={jest.fn()}
      onPremium={jest.fn()}
      onSubmit={onSubmit}
    />,
  );
  await fillForm();
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar link' }));
  await userEvent.type(
    screen.getByLabelText('Breve descrição do link 2 (opcional)'),
    'Projeto sem URL',
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Enviar para análise' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Adicione o link da prova 2',
  );
  expect(onSubmit).not.toHaveBeenCalled();
});

test('fecha com Escape e recupera o foco no botão de origem', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Origem</button>
        {open && (
          <CandidateVerificationModal
            profile={profile}
            onClose={() => setOpen(false)}
            onPremium={jest.fn()}
            onSubmit={jest.fn()}
          />
        )}
      </>
    );
  }
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Origem' });
  await userEvent.click(trigger);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
