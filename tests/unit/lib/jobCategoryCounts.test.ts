import { countJobsByCategory } from '@/lib/jobCategoryCounts';

describe('countJobsByCategory', () => {
  it('conta por categoria, usa «Outros» na falta dela e ordena por total', () => {
    expect(
      countJobsByCategory([
        { categoria: 'Design' },
        { category: 'Programação' },
        { categoria: 'Design' },
        {},
        { categoria: '', category: '' },
      ]),
    ).toEqual([
      { name: 'Design', count: 2 },
      { name: 'Outros', count: 2 },
      { name: 'Programação', count: 1 },
    ]);
  });

  it('sem vagas devolve lista vazia', () => {
    expect(countJobsByCategory([])).toEqual([]);
  });
});
