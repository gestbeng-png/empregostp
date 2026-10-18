import {
  fetchPublicProductAds,
  normalizePublicProductAd,
  safeProductAdUrl,
} from '../../../lib/productAds';

const now = Date.parse('2026-10-07T12:00:00.000Z');
const ad = {
  title: 'Produto real',
  companyName: 'Empresa real',
  description: 'Descrição do produto',
  imageUrl: '/assets/produto.jpg',
  href: 'https://example.com/produto',
  status: 'published',
  order: 2,
};

describe('anúncios de produtos na home', () => {
  test('mostra apenas anúncios publicados com empresa, produto e imagem', () => {
    expect(normalizePublicProductAd('ad-1', ad, now)).toMatchObject({
      id: 'ad-1',
      title: 'Produto real',
      companyName: 'Empresa real',
    });
    expect(
      normalizePublicProductAd('ad-1', { ...ad, status: 'draft' }, now),
    ).toBeNull();
    expect(
      normalizePublicProductAd('ad-1', { ...ad, imageUrl: '' }, now),
    ).toBeNull();
    expect(
      normalizePublicProductAd('ad-1', { ...ad, companyName: '' }, now),
    ).toBeNull();
  });

  test('respeita as datas de início e fim quando existem', () => {
    expect(
      normalizePublicProductAd('ad-1', { ...ad, startsAt: '2026-10-08' }, now),
    ).toBeNull();
    expect(
      normalizePublicProductAd('ad-1', { ...ad, endsAt: '2026-10-06' }, now),
    ).toBeNull();
  });

  test('limpa os campos opcionais do cartão', () => {
    const result = normalizePublicProductAd(
      'ad-1',
      {
        ...ad,
        badges: ['  5G Ready STP ', '', 'Stock', 'A mais'],
        features: ['Garantia', 42, 'Retoma', 'Quarto'],
        price: ' 1.850 STN ',
        companyLogoUrl: 'javascript:alert(1)',
      },
      now,
    );
    expect(result).toMatchObject({
      badges: ['5G Ready STP', 'Stock'],
      features: ['Garantia', '42', 'Retoma'],
      price: '1.850 STN',
      companyLogoUrl: '',
    });
  });

  test('rejeita ligações que não sejam HTTP(S) ou caminhos internos', () => {
    expect(safeProductAdUrl('javascript:alert(1)')).toBe('');
    expect(safeProductAdUrl('//example.com', { allowInternal: true })).toBe('');
    expect(safeProductAdUrl('/produto/1', { allowInternal: true })).toBe(
      '/produto/1',
    );
  });

  test('a consulta pública ordena anúncios válidos e ignora rascunhos', async () => {
    const docs = [
      { id: 'second', data: () => ({ ...ad, order: 2 }) },
      { id: 'draft', data: () => ({ ...ad, status: 'draft' }) },
      { id: 'first', data: () => ({ ...ad, order: 1 }) },
    ];
    const get = jest.fn().mockResolvedValue({ docs });
    const limit = jest.fn().mockReturnValue({ get });
    const where = jest.fn().mockReturnValue({ limit });
    const collection = jest.fn().mockReturnValue({ where });

    const result = await fetchPublicProductAds({ collection });

    expect(collection).toHaveBeenCalledWith('productAds');
    expect(where).toHaveBeenCalledWith('status', '==', 'published');
    expect(result.map((item: { id: string }) => item.id)).toEqual([
      'first',
      'second',
    ]);
  });
});
