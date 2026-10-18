import {
  DISTRICTS,
  islandOf,
  mapLegacyLocation,
  normalizePlace,
} from '@/domain/geo/districts';

describe('B2 — taxonomia oficial', () => {
  it('tem os sete distritos/regiões e o remoto, com os slugs da especificação', () => {
    expect(DISTRICTS.map((district) => district.slug)).toEqual([
      'agua-grande',
      'me-zochi',
      'cantagalo',
      'caue',
      'lemba',
      'lobata',
      'principe',
      'remoto',
    ]);
  });

  it('a ilha deriva do distrito', () => {
    for (const slug of [
      'agua-grande',
      'me-zochi',
      'cantagalo',
      'caue',
      'lemba',
      'lobata',
    ])
      expect(islandOf(slug)).toBe('SAO_TOME');
    expect(islandOf('principe')).toBe('PRINCIPE');
    expect(islandOf('remoto')).toBeNull();
    expect(islandOf('inexistente')).toBeNull();
  });

  it('normaliza acentos, maiúsculas, hífens e pontuação', () => {
    expect(normalizePlace('  Mé-Zóchi,  TRINDADE ')).toBe('me zochi trindade');
  });
});

describe('B2 — mapeamento de localizações antigas', () => {
  it.each([
    ['São Tomé', 'agua-grande'],
    ['Cidade de São Tomé', 'agua-grande'],
    ['Água Grande', 'agua-grande'],
    ['agua grande', 'agua-grande'],
    ['Trindade', 'me-zochi'],
    ['Mé-Zóchi', 'me-zochi'],
    ['Santana', 'cantagalo'],
    ['São João dos Angolares', 'caue'],
    ['Neves', 'lemba'],
    ['Guadalupe', 'lobata'],
    ['Ilha do Príncipe', 'principe'],
    ['Santo António, Príncipe', 'principe'],
    ['Remoto', 'remoto'],
    ['São Tomé, Água Grande', 'agua-grande'],
  ])('%s → %s', (input, district) => {
    expect(mapLegacyLocation(input)).toEqual({
      district,
      legacyLocation: null,
      needsReview: false,
    });
  });

  it.each([
    'São Tomé e Príncipe',
    'S. Tomé e Príncipe',
    'Ilha de São Tomé',
    'Trindade / Neves',
    'Lisboa',
    'Bairro desconhecido',
  ])('%s fica para revisão, sem distrito adivinhado', (input) => {
    expect(mapLegacyLocation(input)).toEqual({
      district: null,
      legacyLocation: input,
      needsReview: true,
    });
  });

  it('vazio não gera revisão', () => {
    expect(mapLegacyLocation('')).toEqual({
      district: null,
      legacyLocation: null,
      needsReview: false,
    });
    expect(mapLegacyLocation(undefined).needsReview).toBe(false);
  });
});
