import {
  APPLICATION_FORM_LIMITS,
  createEmptyApplicationForm,
  firstStepWithErrors,
  normalizeApplicationForm,
  validateApplicationForm,
} from '../../../lib/applicationForm';

function formularioValido() {
  return {
    ...createEmptyApplicationForm(),
    fullName: 'Ana de Sousa',
    email: 'ANA@Exemplo.st',
    phone: '+239 990 1234',
    location: 'Água Grande',
    nationality: 'São-tomense',
    birthDate: '1996-04-12',
    workAuthorization: 'citizen',
    education: [
      { degree: 'Licenciatura em Gestão', institution: 'USTP', year: '2019' },
    ],
    languages: [{ language: 'Português', level: 'native' }],
    coverLetter: 'a'.repeat(120),
    experienceYears: '3_5',
    availability: 'immediate',
    references: [
      {
        name: 'João Lima',
        role: 'Diretor',
        company: 'Djinola',
        contact: 'joao@djinola.st',
      },
      { name: '', role: '', company: '', contact: '' },
    ],
    consentTruthful: true,
    consentDataProcessing: true,
  };
}

describe('normalização do formulário de candidatura', () => {
  test('o email desce a minúsculas e os espaços são colapsados', () => {
    const dados = normalizeApplicationForm({
      ...formularioValido(),
      fullName: '  Ana   de   Sousa  ',
    });

    expect(dados.email).toBe('ana@exemplo.st');
    expect(dados.fullName).toBe('Ana de Sousa');
  });

  test('a carta mantém parágrafos mas colapsa linhas em branco a mais', () => {
    const dados = normalizeApplicationForm({
      coverLetter: 'Primeiro.\n\n\n\nSegundo.',
    });

    expect(dados.coverLetter).toBe('Primeiro.\n\nSegundo.');
  });

  test('um valor fora da lista de opções é descartado, não gravado', () => {
    const dados = normalizeApplicationForm({
      workAuthorization: '<script>alert(1)</script>',
      availability: 'quando_me_apetecer',
      languages: [{ language: 'Inglês', level: 'fluente-ish' }],
    });

    expect(dados.workAuthorization).toBe('');
    expect(dados.availability).toBe('');
    expect(dados.languages[0]?.level).toBe('');
  });

  test('a pretensão salarial fica só com dígitos', () => {
    expect(
      normalizeApplicationForm({ salaryExpectation: '12 500 Dbs' })
        .salaryExpectation,
    ).toBe('12500');
  });

  test('os limites de caracteres são aplicados', () => {
    const dados = normalizeApplicationForm({
      coverLetter: 'x'.repeat(5000),
      fullName: 'y'.repeat(500),
    });

    expect(dados.coverLetter).toHaveLength(APPLICATION_FORM_LIMITS.coverLetter);
    expect(dados.fullName).toHaveLength(APPLICATION_FORM_LIMITS.fullName);
  });

  test('linhas totalmente vazias de formação e referências desaparecem', () => {
    const dados = normalizeApplicationForm(formularioValido());

    expect(dados.education).toHaveLength(1);
    expect(dados.references).toHaveLength(1);
  });

  test('o número de entradas é limitado', () => {
    const dados = normalizeApplicationForm({
      education: Array.from({ length: 20 }, (_, i) => ({
        degree: `Grau ${i}`,
        institution: 'X',
        year: '2020',
      })),
    });

    expect(dados.education).toHaveLength(5);
  });
});

describe('validação do formulário de candidatura', () => {
  test('um formulário completo passa', () => {
    expect(validateApplicationForm(formularioValido())).toEqual({});
  });

  test('um formulário vazio acusa os campos obrigatórios', () => {
    const erros = validateApplicationForm(createEmptyApplicationForm());

    expect(Object.keys(erros).sort()).toEqual(
      [
        'consentDataProcessing',
        'consentTruthful',
        'email',
        'fullName',
        'phone',
      ].sort(),
    );
  });

  test('o consentimento não pode ser dado por omissão', () => {
    const erros = validateApplicationForm({
      ...formularioValido(),
      consentTruthful: 'sim',
    });

    expect(erros.consentTruthful).toBeDefined();
  });

  test('aponta o primeiro passo com erro, para o modal saltar até lá', () => {
    const erros = validateApplicationForm({
      ...formularioValido(),
      consentDataProcessing: false,
    });

    expect(firstStepWithErrors(erros)).toBe(4);
    expect(firstStepWithErrors({})).toBeNull();
  });
});
