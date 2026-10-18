import { Html, Head, Main, NextScript } from 'next/document';

const dashboardThemeBootstrap = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem('estp-theme');
      document.documentElement.dataset.dashboardTheme =
        storedTheme === 'dark' ? 'dark' : 'light';
    } catch (error) {
      document.documentElement.dataset.dashboardTheme = 'light';
    }
  })();
`;

export default function Document() {
  return (
    <Html lang="pt-PT" data-scroll-behavior="smooth">
      <Head>
        <meta charSet="utf-8" />
        <meta name="color-scheme" content="light dark" />
        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
        <link rel="icon" href="/assets/icon-180.png" />
        {/* As duas fontes usadas em todas as páginas começam a descarregar
            junto com o CSS: chegam antes da primeira pintura e a troca de
            fonte deixa de deslocar o conteúdo. */}
        <link
          rel="preload"
          href="/fonts/plus-jakarta-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/instrument-sans-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>
      <body>
        <script
          id="dashboard-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: dashboardThemeBootstrap }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
