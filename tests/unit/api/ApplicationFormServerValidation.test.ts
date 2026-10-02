import {
  normalizeApplicationForm,
  validateApplicationForm,
} from '../../../lib/applicationForm';

/**
 * O modal valida para dar resposta imediata a quem escreve, mas quem faz o
 * pedido pode não ser o modal. Estes casos são os que a rota tem de recusar
 * mesmo quando o cliente diz que está tudo bem.
 */
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
    salaryExpectation: '15000',
    referralSource: 'empregostp',
    references: [
      {
        name: 'João Lima',
        role: 'Diretor',
        company: 'Djinola',
        contact: 'joao@djinola.st',
      },
    ],
    consentTruthful: true,
    consentDataProcessing: true,
    consentSimilarJobs: false,
  };
}

describe('revalidação do formulário no servidor', () => {
  test('um pedido forjado sem consentimento é recusado', () => {
    const erros = validateApplicationForm({
      ...formularioCompleto(),
      consentDataProcessing: false,
    });

    expect(erros.consentDataProcessing).toBeDefined();
  });

  test('um pedido sem referências é recusado', () => {
    const erros = validateApplicationForm({
      ...formularioCompleto(),
      references: [],
    });

    expect(erros.references).toBeDefined();
  });

  test('campos de escolha só aceitam valores da lista', () => {
    const dados = normalizeApplicationForm({
      ...formularioCompleto(),
      workAuthorization: 'sou_o_patrao',
      referralSource: '"><img src=x onerror=alert(1)>',
    });

    expect(dados.workAuthorization).toBe('');
    expect(dados.referralSource).toBe('');
    expect(validateApplicationForm(dados).workAuthorization).toBeDefined();
  });

  test('o texto é cortado no limite antes de ser gravado', () => {
    const dados = normalizeApplicationForm({
      ...formularioCompleto(),
      coverLetter: 'x'.repeat(99999),
      references: [
        { name: 'y'.repeat(500), role: '', company: '', contact: 'a@b.st' },
      ],
    });

    expect(dados.coverLetter.length).toBeLessThanOrEqual(2000);
    expect(dados.references[0]?.name.length).toBeLessThanOrEqual(80);
  });

  test('sem o plano da carta, um formulário sem carta é aceite', () => {
    const erros = validateApplicationForm(
      { ...formularioCompleto(), coverLetter: '' },
      { coverLetterEnabled: false },
    );

    expect(erros).toEqual({});
  });

  test('um formulário completo passa a revalidação', () => {
    expect(validateApplicationForm(formularioCompleto())).toEqual({});
  });
});
