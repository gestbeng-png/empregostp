import { anoDe, formatarIntervaloAnos } from '../../../lib/cvDates';

describe('anoDe', () => {
  it('extrai o ano dos formatos usados no formulário', () => {
    expect(anoDe('2022-03')).toBe('2022');
    expect(anoDe('2022-03-15')).toBe('2022');
    expect(anoDe('2022')).toBe('2022');
    expect(anoDe('')).toBe('');
    expect(anoDe('sem data')).toBe('');
  });
});

describe('formatarIntervaloAnos', () => {
  it('formata o período com os dois anos', () => {
    expect(formatarIntervaloAnos('2022-03', '2024-08')).toBe('2022 - 2024');
    expect(formatarIntervaloAnos('2012-01', '2016-12')).toBe('2012 - 2016');
  });

  it('usa "atual" quando é o emprego corrente', () => {
    expect(formatarIntervaloAnos('2022-03', '', true)).toBe('2022 - atual');
    // O "atual" ganha a uma data de fim deixada para trás no formulário.
    expect(formatarIntervaloAnos('2022-03', '2023-01', true)).toBe(
      '2022 - atual',
    );
  });

  it('não repete o ano quando início e fim coincidem', () => {
    expect(formatarIntervaloAnos('2022-03', '2022-11')).toBe('2022');
  });

  it('lida com períodos incompletos', () => {
    expect(formatarIntervaloAnos('2022-03', '')).toBe('2022');
    expect(formatarIntervaloAnos('', '2024-08')).toBe('2024');
    expect(formatarIntervaloAnos('', '')).toBe('');
    expect(formatarIntervaloAnos('', '', true)).toBe('atual');
  });
});
