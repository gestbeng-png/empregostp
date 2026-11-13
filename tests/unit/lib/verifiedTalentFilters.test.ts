import {
  filterVerifiedTalents,
  getTalentCategory,
  getTalentExperience,
  getTalentFilterOptions,
} from '../../../lib/verifiedTalentFilters';

const talents = [
  {
    id: 'a',
    fullName: 'Ana Graça',
    headline: 'Informática',
    experienceLabel: 'Anos de experiência: 2 anos',
  },
  {
    id: 'b',
    fullName: 'Bruno Lima',
    headline: 'Hotelaria',
    experienceLabel: 'Anos de experiência: 6 anos',
  },
  {
    id: 'c',
    fullName: 'Carla Neves',
    headline: 'informática',
    experienceLabel: 'Perfil profissional verificado',
  },
];

test('as categorias vêm apenas dos títulos públicos e agrupam variantes de capitalização', () => {
  const options = getTalentFilterOptions(talents);
  expect(options.categories).toHaveLength(2);
  expect(
    options.categories.find((option) => option.value === 'informatica')?.count,
  ).toBe(2);
  expect(options.experience.map((option) => option.value)).toEqual([
    '0-2',
    '6-10',
    'not-informed',
  ]);
});

test('categoria, experiência e pesquisa combinam-se sem alterar os dados ou a ordem original', () => {
  const original = JSON.stringify(talents);
  expect(
    filterVerifiedTalents(talents, { category: 'informatica' }).map(
      (item) => item.id,
    ),
  ).toEqual(['a', 'c']);
  expect(
    filterVerifiedTalents(talents, {
      category: 'informatica',
      experience: '0-2',
      query: 'GRACA ana',
    }),
  ).toEqual([talents[0]]);
  expect(
    filterVerifiedTalents(talents, {
      category: 'hotelaria',
      experience: '0-2',
    }),
  ).toEqual([]);
  expect(JSON.stringify(talents)).toBe(original);
});

test('a pesquisa não consulta campos privados que possam existir no objeto', () => {
  const candidate = {
    ...talents[0],
    bio: 'segredo-experiencia',
    phone: '987654',
    salary: '12345',
    email: 'privado@example.test',
  };
  for (const query of [
    'segredo-experiencia',
    '987654',
    '12345',
    'privado@example.test',
  ]) {
    expect(filterVerifiedTalents([candidate], { query })).toEqual([]);
  }
});

test.each([
  ['Anos de experiência: 1 ano', '0-2'],
  ['Anos de experiência: 2 anos', '0-2'],
  ['Anos de experiência: 3 anos', '3-5'],
  ['Anos de experiência: 5 anos', '3-5'],
  ['Anos de experiência: Mais de 5 anos', '6-10'],
  ['Anos de experiência: 10 anos', '6-10'],
  ['Anos de experiência: 11 anos', '10-plus'],
  ['Perfil profissional verificado', 'not-informed'],
  ['Experiência profissional registada', 'not-informed'],
])(
  'classifica a experiência pública %s como %s',
  (experienceLabel, expected) => {
    expect(getTalentExperience({ experienceLabel })).toBe(expected);
  },
);

test('não inventa uma categoria nem anos de experiência quando não estão declarados', () => {
  expect(getTalentCategory({ headline: 'Profissional' })).toEqual({
    value: 'not-informed',
    label: 'Área não informada',
  });
  expect(getTalentExperience({})).toBe('not-informed');
  expect(getTalentFilterOptions([])).toEqual({
    categories: [],
    experience: [],
  });
});
