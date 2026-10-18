import { fireEvent, render, screen } from '@testing-library/react';

import ProductAdsCarousel from '../../../components/home/ProductAdsCarousel';

const ads = [
  {
    id: 'one',
    title: 'Produto A',
    companyName: 'Empresa A',
    imageUrl: '/assets/a.jpg',
    href: 'https://example.com/a',
    description: '',
  },
  {
    id: 'two',
    title: 'Produto B',
    companyName: 'Empresa B',
    imageUrl: 'https://firebasestorage.googleapis.com/example.jpg',
    href: 'https://example.com/b',
    description: '',
  },
];

describe('ProductAdsCarousel', () => {
  test('mostra um estado vazio sem inventar anúncios', () => {
    render(<ProductAdsCarousel ads={[]} />);
    expect(
      screen.getByRole('region', {
        name: 'Anúncios de empresas',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ainda não há anúncios publicados'),
    ).toBeInTheDocument();
  });

  test('mostra uma peça local como pré-visualização, sem a publicar', () => {
    render(
      <ProductAdsCarousel
        ads={[]}
        previewCreativeSrc="/assets/product-ads/carro-preview.png"
      />,
    );

    expect(
      screen.getByRole('img', {
        name: /Peça publicitária em pré-visualização/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Pré-visualização')).toHaveLength(2);
    expect(screen.getByText('Não publicado')).toBeInTheDocument();
    expect(screen.getByText('Peça ainda não publicada')).toBeInTheDocument();
    expect(screen.queryByText('Produto A')).not.toBeInTheDocument();
  });

  test('mostra anúncios reais e permite avançar e recuar', () => {
    render(<ProductAdsCarousel ads={ads} />);
    expect(
      screen.getByRole('heading', { name: 'Produto A' }),
    ).toBeInTheDocument();
    // Sem logótipo mostra-se só o nome da empresa, sem inicial.
    expect(screen.getByText('Empresa A')).toBeInTheDocument();
    expect(screen.queryByText('EA')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saiba mais' })).toHaveAttribute(
      'href',
      'https://example.com/a',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Próximo anúncio' }));
    expect(
      screen.getByRole('heading', { name: 'Produto B' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anúncio anterior' }));
    expect(
      screen.getByRole('heading', { name: 'Produto A' }),
    ).toBeInTheDocument();
  });

  test('mostra selos, destaques, preço e botão como no cartão da vitrine', () => {
    render(
      <ProductAdsCarousel
        ads={[
          {
            id: 'one',
            title: 'Produto A',
            imageUrl: '/assets/a.jpg',
            href: 'https://example.com/a',
            description: '',
            companyName: 'CST Telecom & Tech Parceiros',
            badges: ['5G Ready STP', 'Stock Limitado'],
            features: [
              '2 Anos Garantia',
              '+50GB Dados Grátis',
              'Retoma Aceite',
            ],
            priceLabel: 'Condição mensal',
            price: '1.850 STN',
            priceSuffix: '/mês',
          },
        ]}
      />,
    );

    expect(
      screen.getByText('CST Telecom & Tech Parceiros'),
    ).toBeInTheDocument();
    expect(screen.queryByText('CST')).not.toBeInTheDocument();
    expect(screen.getByText('5G Ready STP')).toBeInTheDocument();
    expect(screen.getByText('Stock Limitado')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Condição mensal')).toBeInTheDocument();
    expect(screen.getByText('/mês')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saiba mais' })).toHaveAttribute(
      'rel',
      'noopener noreferrer sponsored',
    );
    expect(
      screen.queryByRole('button', { name: 'Próximo anúncio' }),
    ).not.toBeInTheDocument();
  });
});
