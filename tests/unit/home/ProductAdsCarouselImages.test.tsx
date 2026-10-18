import type * as TestingLibrary from '@testing-library/react';
import type * as ReactModule from 'react';

const BUCKET = 'empregostp.firebasestorage.app';

// O prefixo do bucket é lido quando o módulo carrega, por isso o componente,
// o React e a Testing Library (versão `pure`, sem hooks globais) carregam
// juntos num registo isolado, já com a variável de ambiente definida.
function renderAdImageSrc(imageUrl: string) {
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = BUCKET;
  let src: string | null = null;
  jest.isolateModules(() => {
    const React = jest.requireActual<typeof ReactModule>('react');
    const { render, screen, cleanup } = jest.requireActual<
      typeof TestingLibrary
    >('@testing-library/react/pure');
    const Carousel = jest.requireActual<{
      default: ReactModule.ComponentType<{ ads: unknown[] }>;
    }>('../../../components/home/ProductAdsCarousel').default;

    render(
      React.createElement(Carousel, {
        ads: [
          {
            id: 'a',
            title: 'Produto',
            companyName: 'Empresa',
            description: '',
            imageUrl,
            href: '',
          },
        ],
      }),
    );
    src = screen.getByRole('img', { name: 'Produto' }).getAttribute('src');
    cleanup();
  });
  return src;
}

describe('ProductAdsCarousel: otimização das imagens', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  });

  test('imagem do Storage do projeto passa pelo otimizador', () => {
    const src = renderAdImageSrc(
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/product-ads%2Fx.jpg?alt=media`,
    );
    expect(src).toContain('/_next/image?url=');
  });

  test('link externo de terceiros é mostrado tal como está', () => {
    expect(renderAdImageSrc('https://exemplo.com/foto.jpg')).toBe(
      'https://exemplo.com/foto.jpg',
    );
  });
});
