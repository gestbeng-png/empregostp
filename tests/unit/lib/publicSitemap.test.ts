import { collectPublicSitemap, renderPublicSitemap } from '../../../lib/publicSitemap';

test('indexa só vagas abertas e conteúdo público, sem dados de candidatos', async () => {
  const record = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });
  const collections: Record<string, unknown[]> = {
    jobs: [record('open', { status: 'active', updatedAt: '2026-10-01' }), record('closed', { status: 'closed' }), record('expired', { status: 'active', dataFecho: '2020-01-01' }), record('hidden', { status: 'active', v2Status: 'HIDDEN' })],
    posts: [record('article', { status: 'published' }), record('draft', { status: 'draft' })],
    news: [record('news', { status: 'published' }), record('draft', { status: 'published' })],
  };
  const collection = jest.fn((name: string) => ({ get: async () => ({ docs: collections[name] }) }));
  const result = await collectPublicSitemap({ collection }, new Date('2026-10-11'));
  const paths = result.map((entry: { path: string }) => entry.path);
  expect(paths).toEqual(expect.arrayContaining(['/vaga/open', '/blog/article', '/blog/news']));
  for (const path of ['/vaga/closed', '/vaga/expired', '/vaga/hidden', '/blog/draft', '/candidatos']) expect(paths).not.toContain(path);
  expect(collection.mock.calls.map(([name]) => name)).toEqual(['jobs', 'posts', 'news']);
  expect(result.find((entry: { path: string }) => entry.path === '/vaga/open')).toMatchObject({ lastmod: '2026-10-01T00:00:00.000Z' });
});

test('escapa XML sem alterar o endereço canónico', () => {
  expect(renderPublicSitemap([{ path: '/blog/a?x=1&y=2' }], 'https://empregostp.com')).toContain('x=1&amp;y=2');
});
