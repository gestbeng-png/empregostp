import { render, screen } from '@testing-library/react';

import ApplicationSubmission, {
  serializeApplicationSubmission,
} from '../../../components/empresa/ApplicationSubmission';

jest.mock('../../../lib/candidateCvClient', () => ({
  openApplicationDocument: jest.fn(),
}));

const CANDIDATURA = {
  coverLetter: 'Escrevo para me candidatar a esta vaga.',
  skillsAssessmentResult: {
    correctAnswers: 4,
    totalQuestions: 5,
    score: 80,
    passed: true,
  },
  requiredDocuments: [
    { id: 'criminal_record', label: 'Registo criminal' },
  ],
  applicationForm: {
    phone: '+239 990 1234',
    email: 'ana@exemplo.st',
    location: 'Água Grande',
    nationality: 'São-tomense',
    birthDate: '1996-04-12',
    workAuthorization: 'citizen',
    experienceYears: '3_5',
    availability: 'immediate',
    salaryExpectation: '15000',
    referralSource: 'empregostp',
    education: [
      { degree: 'Licenciatura em Gestão', institution: 'USTP', year: '2019' },
    ],
    languages: [{ language: 'Português', level: 'native' }],
    references: [
      {
        name: 'João Lima',
        role: 'Diretor',
        company: 'Djinola',
        contact: 'joao@djinola.st',
      },
    ],
    consentSimilarJobs: true,
    documents: {
      criminal_record: { url: 'https://x/r.pdf', name: 'registo.pdf' },
    },
  },
};

// Monta como as páginas montam: serializa no servidor e passa o resultado.
function montar(extra = {}) {
  const serializado = serializeApplicationSubmission(CANDIDATURA);
  return render(
    <ApplicationSubmission
      applicationId="app-1"
      coverLetter={serializado.coverLetter}
      form={serializado.applicationForm}
      documents={serializado.documents}
      requiredDocuments={serializado.requiredDocuments}
      assessment={serializado.assessment}
      {...extra}
    />,
  );
}

describe('tudo o que o candidato enviou', () => {
  test('mostra os dados traduzidos, não os códigos internos', () => {
    montar();

    expect(screen.getByText('Cidadão são-tomense')).toBeInTheDocument();
    expect(screen.getByText('3 a 5 anos')).toBeInTheDocument();
    expect(screen.getByText('Imediata')).toBeInTheDocument();
    expect(screen.getByText('15000 Dbs/mês')).toBeInTheDocument();
    expect(screen.queryByText('citizen')).toBeNull();
  });

  test('mostra formação, idiomas, referências e carta', () => {
    montar();

    expect(
      screen.getByText('Licenciatura em Gestão — USTP — 2019'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Português — Língua materna'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('João Lima · Diretor · Djinola · joao@djinola.st'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Escrevo para me candidatar a esta vaga.'),
    ).toBeInTheDocument();
  });

  test('mostra o resultado do teste e os documentos entregues', () => {
    montar();

    expect(screen.getByText(/4\/5 corretas/)).toBeInTheDocument();
    expect(screen.getByText('Registo criminal')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /registo\.pdf/ }),
    ).toBeInTheDocument();
  });

  test('esconde email e telefone quando a página os bloqueia', () => {
    montar({ hideContact: true });

    expect(screen.queryByText('ana@exemplo.st')).toBeNull();
    expect(screen.queryByText('+239 990 1234')).toBeNull();
    // O resto continua visível: só o contacto é que está barrado.
    expect(screen.getByText('Água Grande')).toBeInTheDocument();
  });

  test('sem bloqueio, o contacto aparece', () => {
    montar();

    expect(screen.getByText('ana@exemplo.st')).toBeInTheDocument();
  });

  test('uma candidatura antiga, sem formulário, não renderiza nada', () => {
    const { container } = render(
      <ApplicationSubmission applicationId="app-2" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('a serialização não deixa passar URLs permanentes dos documentos', () => {
    const serializado = serializeApplicationSubmission(CANDIDATURA);

    expect(JSON.stringify(serializado)).not.toContain('https://x/r.pdf');
    expect(serializado.documents[0]?.files[0]?.name).toBe('registo.pdf');
  });
});
