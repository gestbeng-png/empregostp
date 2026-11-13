import {
  PLAN_CURRENCY,
  formatPlanPrice,
  normalizePlanPriceLabel,
} from '@/lib/payments/currency';

/**
 * Moeda única nos preços dos planos.
 *
 * O catálogo chegou a mostrar "100 Dobras" ao lado de "250 STD" na mesma
 * tabela pública, porque metade dos rótulos vinha de texto escrito à mão nos
 * documentos do Firestore. A regra passou a ser: o número é o que o admin
 * grava em `price`; a moeda e o separador de milhares são sempre derivados.
 */

describe('moeda dos planos', () => {
  test('a moeda do produto é STD', () => {
    expect(PLAN_CURRENCY).toBe('STD');
  });

  test.each([
    [0, '0 STD'],
    [20, '20 STD'],
    [250, '250 STD'],
    [1500, '1.500 STD'],
    [5000, '5.000 STD'],
    [12000, '12.000 STD'],
  ])('formata %p como %p', (price, expected) => {
    expect(formatPlanPrice(price)).toBe(expected);
  });

  test.each([null, undefined, 'abc', Number.NaN, -10])(
    'preço inválido (%p) não inventa valor',
    (price) => {
      expect(formatPlanPrice(price)).toBe('0 STD');
    },
  );

  test('não usa toLocaleString: o separador não pode depender do ICU', () => {
    // Em Node com ICU reduzido `toLocaleString` devolve "1500" e no browser
    // "1.500". Se o rótulo dependesse disso, o HTML do servidor e o do
    // cliente divergiam e a hidratação partia.
    expect(formatPlanPrice(1500)).toBe('1.500 STD');
    expect(formatPlanPrice(1500)).toBe(
      String(1500).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' STD',
    );
  });

  describe('rótulos guardados pelo admin', () => {
    test.each([
      ['100 Dobras', 100, '100 STD'],
      ['5000 Dobras', 5000, '5.000 STD'],
      ['275 STN', 275, '275 STD'],
      ['375 db', 375, '375 STD'],
      ['250 STD', 250, '250 STD'],
    ])('%p com preço %p passa a %p', (label, price, expected) => {
      expect(normalizePlanPriceLabel(label, price)).toBe(expected);
    });

    test('o preço do admin manda sobre o número escrito no rótulo', () => {
      // Se o admin mudar o preço e esquecer o texto, vale o preço.
      expect(normalizePlanPriceLabel('100 Dobras', 900)).toBe('900 STD');
    });

    test('preserva a periodicidade', () => {
      expect(normalizePlanPriceLabel('750 STD/mês', 750)).toBe('750 STD/mês');
      expect(normalizePlanPriceLabel('2.000 Dobras/mês', 2000)).toBe(
        '2.000 STD/mês',
      );
    });

    test('rótulos sem valor não são tratados como preço', () => {
      expect(normalizePlanPriceLabel('Gratuito', 0)).toBe('Gratuito');
      expect(normalizePlanPriceLabel('Grátis', 0)).toBe('Grátis');
    });

    test('rótulo vazio ou ausente deriva do preço', () => {
      expect(normalizePlanPriceLabel('', 1500)).toBe('1.500 STD');
      expect(normalizePlanPriceLabel(null, 250)).toBe('250 STD');
      expect(normalizePlanPriceLabel(undefined, 0)).toBe('0 STD');
    });

    test('nunca deixa passar outra moeda', () => {
      for (const label of [
        '100 Dobras',
        '100 dobras',
        '100 DOBRAS',
        '100 STN',
        '100 Db',
      ]) {
        expect(normalizePlanPriceLabel(label, 100)).not.toMatch(
          /dobras?|stn/i,
        );
        expect(normalizePlanPriceLabel(label, 100)).toContain('STD');
      }
    });
  });
});
