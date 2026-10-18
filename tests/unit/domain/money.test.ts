import {
  approximateInStn,
  formatMoney,
  formatSalary,
  isSalaryOutsideSanity,
  parseLegacySalary,
  THIN_NBSP,
  validateSalary,
} from '@/domain/money/money';

const n = THIN_NBSP;

describe('B3 — formatMoney', () => {
  it('formata Dobras com espaço fino inseparável e sem decimais', () => {
    expect(formatMoney(350_000, 'STN')).toBe(`3${n}500 Db`);
    expect(formatMoney(350_000, 'STN', { period: 'MONTH' })).toBe(
      `3${n}500 Db/mês`,
    );
    expect(formatMoney(123_456_789, 'STN')).toBe(`1${n}234${n}568 Db`);
    expect(formatMoney(99_900, 'STN')).toBe('999 Db');
    expect(formatMoney(120_000, 'EUR', { period: 'MONTH' })).toBe(
      `1${n}200 €/mês`,
    );
  });

  it('nunca usa vírgulas, pontos nem o espaço normal como separador', () => {
    expect(formatMoney(700_000_00, 'STN')).not.toMatch(/[.,]|\d \d/);
  });

  it('recusa floats e moedas desconhecidas', () => {
    expect(formatMoney(10.5, 'STN')).toBe('');
    expect(formatMoney(100, 'USD' as never)).toBe('');
  });
});

describe('F1.4 — exibição do salário', () => {
  it.each([
    [
      {
        type: 'RANGE',
        minMinor: 350_000,
        maxMinor: 700_000,
        currency: 'STN',
        period: 'MONTH',
      },
      `3${n}500 – 7${n}000 Db/mês`,
    ],
    [
      { type: 'FROM', minMinor: 500_000, currency: 'STN', period: 'MONTH' },
      `A partir de 5${n}000 Db/mês`,
    ],
    [
      {
        type: 'FIXED',
        minMinor: 500_000,
        maxMinor: 500_000,
        currency: 'STN',
        period: 'MONTH',
      },
      `5${n}000 Db/mês`,
    ],
    [{ type: 'NEGOTIABLE', currency: 'STN' }, 'Salário negociável'],
    [{ type: 'UNDISCLOSED', currency: 'STN' }, 'Salário não divulgado'],
  ] as const)('%o → %s', (salary, expected) => {
    expect(formatSalary(salary)).toBe(expected);
  });

  it('≈ Db ao lado de EUR só com taxa configurada', () => {
    expect(approximateInStn(100_000, 24.5)).toBe(`≈ 24${n}500 Db`);
    expect(approximateInStn(100_000, undefined)).toBe('');
  });
});

describe('F1.4 — validação', () => {
  const base = { currency: 'STN', period: 'MONTH' } as const;
  it.each([
    [
      { ...base, type: 'RANGE', minMinor: 700_000, maxMinor: 350_000 },
      ['RANGE_ORDER'],
    ],
    [
      { ...base, type: 'RANGE', minMinor: 100_000, maxMinor: 600_000 },
      ['RANGE_TOO_WIDE'],
    ],
    [{ ...base, type: 'RANGE', minMinor: 100_000, maxMinor: 500_000 }, []],
    [{ ...base, type: 'FROM' }, ['MIN_REQUIRED']],
    [
      { ...base, type: 'FIXED', minMinor: 1.5 },
      ['INVALID_AMOUNT', 'MIN_REQUIRED'],
    ],
    [
      { type: 'FIXED', minMinor: 500_000, currency: 'STN' },
      ['PERIOD_REQUIRED'],
    ],
    [{ type: 'NEGOTIABLE', currency: 'STN' }, []],
  ] as const)('%o → %o', (salary, issues) => {
    expect(validateSalary(salary)).toEqual(issues);
  });
});

describe('F1.4 — sanidade (aviso + sinal de risco, não bloqueia)', () => {
  it.each([
    [
      { type: 'FIXED', minMinor: 90_000, currency: 'STN', period: 'MONTH' },
      true,
    ],
    [
      { type: 'FIXED', minMinor: 60_000_000, currency: 'STN', period: 'MONTH' },
      true,
    ],
    [
      {
        type: 'RANGE',
        minMinor: 350_000,
        maxMinor: 700_000,
        currency: 'STN',
        period: 'MONTH',
      },
      false,
    ],
    [
      { type: 'FIXED', minMinor: 3_000_000, currency: 'STN', period: 'YEAR' },
      false,
    ],
    [
      { type: 'FIXED', minMinor: 1_000, currency: 'STN', period: 'HOUR' },
      false,
    ],
    [{ type: 'NEGOTIABLE', currency: 'STN' }, false],
  ] as const)('%o → %s', (salary, outside) => {
    expect(isSalaryOutsideSanity(salary)).toBe(outside);
  });

  it('EUR sem taxa não é avaliado; com taxa é', () => {
    const eur = {
      type: 'FIXED',
      minMinor: 2_000,
      currency: 'EUR',
      period: 'MONTH',
    } as const;
    expect(isSalaryOutsideSanity(eur)).toBe(false);
    expect(isSalaryOutsideSanity(eur, { stnPerEur: 24.5 })).toBe(true);
  });
});

describe('B3 — salários legados', () => {
  const after2018 = new Date('2026-08-03T00:00:00Z');
  it.each([
    ['3500', 350_000],
    ['3.500', 350_000],
    ['3 500', 350_000],
    ['3.500,50', 350_050],
    ['7,000', 700_000],
  ])('%s → %i cêntimos', (value, minor) => {
    expect(parseLegacySalary(value, after2018)).toEqual({
      amountMinor: minor,
      needsReview: false,
    });
  });

  it('≥ 1 000 000 depois de 2018 fica para revisão (provável STD antiga), sem converter', () => {
    expect(parseLegacySalary('3.500.000', after2018)).toEqual({
      amountMinor: 350_000_000,
      needsReview: true,
    });
    expect(
      parseLegacySalary('3.500.000', new Date('2017-05-01T00:00:00Z'))
        .needsReview,
    ).toBe(false);
  });

  it('vazio não precisa de revisão; lixo e negativos sim', () => {
    expect(parseLegacySalary('', after2018)).toEqual({
      amountMinor: null,
      needsReview: false,
    });
    expect(parseLegacySalary('a combinar', after2018)).toEqual({
      amountMinor: null,
      needsReview: true,
    });
    expect(parseLegacySalary('-300', after2018).needsReview).toBe(true);
  });
});
