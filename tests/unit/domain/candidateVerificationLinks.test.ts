import { validateCompetencyLinks } from '../../../lib/candidateVerificationLinks';

describe('links de prova de competências', () => {
  test('preserva a ordem e a descrição de cada URL, ignorando apenas linhas vazias', () => {
    expect(
      validateCompetencyLinks([
        { url: ' https://example.com/projeto ', description: ' Projeto web ' },
        { url: '', description: '' },
        { url: 'https://example.com/portfolio' },
      ]),
    ).toEqual({
      error: '',
      links: [
        { url: 'https://example.com/projeto', description: 'Projeto web' },
        { url: 'https://example.com/portfolio', description: '' },
      ],
    });
    expect(validateCompetencyLinks().error).toBe('');
  });

  test.each([
    { value: null },
    { value: 'https://example.com' },
    { value: [null] },
    { value: [{ url: 'javascript:alert(1)' }] },
    { value: [{ url: 'example.com' }] },
    { value: [{ url: '', description: 'Falta o endereço' }] },
    { value: [{ url: 'https://example.com', description: 123 }] },
    { value: [{ url: `https://example.com/${'a'.repeat(2000)}` }] },
    { value: [{ url: 'https://example.com', description: 'a'.repeat(501) }] },
    {
      value: [{ url: 'https://example.com' }, { url: 'https://example.com/' }],
    },
    {
      value: Array.from({ length: 11 }, (_, index) => ({
        url: `https://example.com/${index}`,
      })),
    },
  ])(
    'recusa links malformados, repetidos e acima dos limites: %j',
    ({ value }) => {
      expect(validateCompetencyLinks(value)).toMatchObject({
        links: [],
        error: expect.any(String),
      });
      expect(validateCompetencyLinks(value).error).not.toBe('');
    },
  );

  test('aceita dez links e descrições de até 500 caracteres', () => {
    const links = Array.from({ length: 10 }, (_, index) => ({
      url: `https://example.com/${index}`,
      description: 'a'.repeat(500),
    }));
    expect(validateCompetencyLinks(links)).toEqual({ links, error: '' });
  });
});
