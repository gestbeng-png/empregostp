import {
  mesAtual,
  validarAno,
  validarDataNascimento,
  validarEmail,
  validarFormularioCv,
  validarIntervalo,
  validarLinkedin,
  validarMes,
  validarNome,
  validarTelefone,
  validarUrl,
} from '../../../lib/cvValidation';

// Data fixa: os testes não podem depender do dia em que correm.
const HOJE = new Date('2026-08-23T12:00:00Z');

describe('validação de datas', () => {
  it('exige o formato AAAA-MM-DD na data de nascimento', () => {
    expect(validarDataNascimento('23/08/1990', { hoje: HOJE })).toMatch(
      /AAAA-MM-DD/,
    );
    expect(validarDataNascimento('1990-8-23', { hoje: HOJE })).toMatch(
      /AAAA-MM-DD/,
    );
    expect(validarDataNascimento('1990-08-23', { hoje: HOJE })).toBe('');
  });

  it('rejeita datas que não existem no calendário', () => {
    // Passa na expressão regular mas 30 de Fevereiro não existe.
    expect(validarDataNascimento('1990-02-30', { hoje: HOJE })).toMatch(
      /não existe/,
    );
    expect(validarDataNascimento('1990-04-31', { hoje: HOJE })).toMatch(
      /não existe/,
    );
    expect(validarDataNascimento('1992-02-29', { hoje: HOJE })).toBe('');
  });

  it('rejeita datas futuras e idades implausíveis', () => {
    expect(validarDataNascimento('2030-01-01', { hoje: HOJE })).toMatch(
      /futura/,
    );
    expect(validarDataNascimento('2020-01-01', { hoje: HOJE })).toMatch(
      /14 anos/,
    );
    expect(validarDataNascimento('1890-01-01', { hoje: HOJE })).toMatch(
      /ano de nascimento/,
    );
  });

  it('exige AAAA-MM nos meses e recusa o futuro por omissão', () => {
    expect(validarMes('2020-13', { hoje: HOJE })).toMatch(/AAAA-MM/);
    expect(validarMes('2020', { hoje: HOJE })).toMatch(/AAAA-MM/);
    expect(validarMes('2020-06', { hoje: HOJE })).toBe('');
    expect(validarMes('2030-06', { hoje: HOJE })).toMatch(/futura/);
    // A formação pode ter conclusão prevista.
    expect(validarMes('2030-06', { permitirFuturo: true, hoje: HOJE })).toBe(
      '',
    );
  });

  it('deteta um fim anterior ao início, exceto se for o emprego atual', () => {
    expect(validarIntervalo('2020-06', '2019-01')).toMatch(/anterior/);
    expect(validarIntervalo('2019-01', '2020-06')).toBe('');
    expect(validarIntervalo('2020-06', '2019-01', { atual: true })).toBe('');
  });

  it('valida o ano das certificações', () => {
    expect(validarAno('19', { hoje: HOJE })).toMatch(/4 dígitos/);
    expect(validarAno('1800', { hoje: HOJE })).toMatch(/posterior/);
    expect(validarAno('2035', { hoje: HOJE })).toMatch(/futuro/);
    expect(validarAno('2019', { hoje: HOJE })).toBe('');
    // O ano seguinte é aceite: há certificações agendadas.
    expect(validarAno('2027', { hoje: HOJE })).toBe('');
  });

  it('calcula o mês corrente sem depender do fuso', () => {
    expect(mesAtual(HOJE)).toBe('2026-08');
  });
});

describe('validação de contactos', () => {
  it('valida o email', () => {
    expect(validarEmail('', { obrigatorio: true })).toMatch(/Indique/);
    expect(validarEmail('semarroba.com')).toMatch(/inválido/i);
    expect(validarEmail('a@b')).toMatch(/inválido/i);
    expect(validarEmail('ana.silva@exemplo.com')).toBe('');
  });

  it('valida o telefone aceitando o formato de São Tomé', () => {
    expect(validarTelefone('+239 991 2345')).toBe('');
    expect(validarTelefone('(239) 991-2345')).toBe('');
    expect(validarTelefone('991')).toMatch(/curto/);
    expect(validarTelefone('telefone: 991 2345')).toMatch(/inválido/i);
  });

  it('valida endereços com ou sem esquema', () => {
    expect(validarUrl('exemplo.com')).toBe('');
    expect(validarUrl('https://exemplo.com/pagina')).toBe('');
    expect(validarUrl('nao e um url')).toMatch(/válido/);
    expect(validarLinkedin('https://facebook.com/ana')).toMatch(/LinkedIn/);
    expect(validarLinkedin('linkedin.com/in/ana')).toBe('');
  });
});

describe('validação do nome', () => {
  it('exige nome e apelido, sem números', () => {
    expect(validarNome('')).toMatch(/Indique/);
    expect(validarNome('An')).toMatch(/3 caracteres/);
    expect(validarNome('Ana')).toMatch(/nome completo/);
    expect(validarNome('Ana Silva 2')).toMatch(/números/);
    expect(validarNome('Ana Silva')).toBe('');
  });
});

describe('validação do formulário completo', () => {
  const valido = {
    fullName: 'Ana Silva',
    email: 'ana@exemplo.com',
    phone: '+239 991 2345',
    birthDate: '1990-05-10',
    experiences: [
      {
        startDate: '2019-01',
        endDate: '2021-06',
        current: false,
        description: 'Trabalho.',
      },
    ],
    educationEntries: [
      { startDate: '2015-09', endDate: '2019-07', details: '' },
    ],
    certifications: [{ year: '2020' }],
    projects: [{ link: 'https://exemplo.com', summary: 'Resumo.' }],
  };

  it('aceita um formulário correto', () => {
    const resultado = validarFormularioCv(valido, { hoje: HOJE });
    expect(resultado.valido).toBe(true);
    expect(resultado.total).toBe(0);
  });

  it('agrupa os erros das listas por índice', () => {
    const resultado = validarFormularioCv(
      {
        ...valido,
        experiences: [
          { startDate: '2019-01', endDate: '2021-06' },
          { startDate: '2022-01', endDate: '2020-01' },
        ],
      },
      { hoje: HOJE },
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.erros.experiences).toEqual({
      1: { endDate: expect.stringMatching(/anterior/) },
    });
  });

  it('conta todos os erros, incluindo os das listas', () => {
    const resultado = validarFormularioCv(
      {
        fullName: 'X',
        email: 'invalido',
        experiences: [{ startDate: '2030-01' }],
      },
      { hoje: HOJE },
    );
    expect(resultado.total).toBe(3);
  });
});
