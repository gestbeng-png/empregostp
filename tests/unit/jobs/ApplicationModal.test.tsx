import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import ApplicationModal from '../../../components/ApplicationModal';
import { createEmptyApplicationForm } from '../../../lib/applicationForm';

function Anfitriao({
  onSubmit,
  inicial,
  coverLetterEnabled = true,
}: {
  onSubmit: (form: unknown) => void;
  inicial?: Record<string, unknown>;
  coverLetterEnabled?: boolean;
}) {
  const [form, setForm] = useState({
    ...createEmptyApplicationForm(),
    ...(inicial || {}),
  });
  return (
    <ApplicationModal
      isOpen
      onClose={() => {}}
      job={{ titulo: 'Programador', companyName: 'Djinola' }}
      form={form}
      onChange={setForm}
      onSubmit={onSubmit}
      coverLetterEnabled={coverLetterEnabled}
    />
  );
}

function formularioCompleto() {
  return {
    fullName: 'Ana de Sousa',
    email: 'ana@exemplo.st',
    phone: '+239 990 1234',
    location: 'Água Grande',
    nationality: 'São-tomense',
    birthDate: '1996-04-12',
    workAuthorization: 'citizen',
    education: [{ degree: 'Licenciatura', institution: 'USTP', year: '2019' }],
    languages: [{ language: 'Português', level: 'native' }],
    coverLetter: 'a'.repeat(120),
    experienceYears: '3_5',
    availability: 'immediate',
    references: [
      { name: 'João Lima', role: 'Diretor', company: 'D', contact: 'j@d.st' },
    ],
    consentTruthful: true,
    consentDataProcessing: true,
  };
}

async function flushRaf() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe('modal de candidatura', () => {
  test('abre no primeiro passo e identifica a vaga', () => {
    render(<Anfitriao onSubmit={jest.fn()} />);

    expect(
      screen.getByRole('dialog', { name: /Programador/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Passo 1 de 5/)).toBeInTheDocument();
  });

  test('não avança com o passo por preencher, e diz o que falta', () => {
    render(<Anfitriao onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));

    expect(screen.getByText(/Passo 1 de 5/)).toBeInTheDocument();
    expect(screen.getByText('Indique o seu nome completo.')).toBeInTheDocument();
  });

  test('os erros só aparecem depois de tentar avançar', () => {
    render(<Anfitriao onSubmit={jest.fn()} />);

    expect(screen.queryByText('Indique o seu nome completo.')).toBeNull();
  });

  test('avança quando o passo está preenchido', () => {
    render(<Anfitriao onSubmit={jest.fn()} inicial={formularioCompleto()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));

    expect(screen.getByText(/Passo 2 de 5/)).toBeInTheDocument();
  });

  test('um formulário completo é submetido', () => {
    const enviar = jest.fn();
    render(<Anfitriao onSubmit={enviar} inicial={formularioCompleto()} />);

    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar candidatura' }),
    );

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toMatchObject({
      fullName: 'Ana de Sousa',
      availability: 'immediate',
    });
  });

  test('um campo em falta prende no passo dele e nunca chega ao envio', () => {
    const enviar = jest.fn();
    render(
      <Anfitriao
        onSubmit={enviar}
        inicial={{ ...formularioCompleto(), availability: '' }}
      />,
    );

    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));
    }

    expect(screen.getByText(/Passo 3 de 5/)).toBeInTheDocument();
    expect(
      screen.getByText('Indique a sua disponibilidade.'),
    ).toBeInTheDocument();
    // Sem chegar ao último passo não há sequer botão de envio.
    expect(screen.queryByRole('button', { name: 'Enviar candidatura' })).toBeNull();
    expect(enviar).not.toHaveBeenCalled();
  });

  test('sem o plano da carta, o campo é substituído pelo aviso e não bloqueia', () => {
    const enviar = jest.fn();
    render(
      <Anfitriao
        onSubmit={enviar}
        coverLetterEnabled={false}
        inicial={{ ...formularioCompleto(), coverLetter: '' }}
      />,
    );

    for (let i = 0; i < 2; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));
    }

    expect(screen.getByText(/planos Profissional e Premium/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar candidatura' }),
    );

    expect(enviar).toHaveBeenCalledTimes(1);
  });
  test('escrever num campo não rouba o foco para o nome completo', async () => {
    render(<Anfitriao onSubmit={jest.fn()} />);

    // O anfitriao passa um `onClose` novo a cada render, tal como a pagina da
    // vaga. Antes, isso re-corria o efeito do foco e cada tecla devolvia o
    // cursor ao primeiro campo do formulario.
    // Deixa passar o autofoco inicial (que e mesmo para o primeiro campo).
    await flushRaf();

    const email = screen.getByLabelText(/Email/) as HTMLInputElement;
    email.focus();
    fireEvent.change(email, { target: { value: 'ana@exemplo.st' } });

    await flushRaf();

    expect(document.activeElement).toBe(screen.getByLabelText(/Email/));
    expect(document.activeElement).not.toBe(
      screen.getByLabelText(/Nome completo/),
    );
    expect((screen.getByLabelText(/Email/) as HTMLInputElement).value).toBe(
      'ana@exemplo.st',
    );
  });
});
