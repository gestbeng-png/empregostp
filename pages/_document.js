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
        <link rel="icon" href="/assets/Emprego STP Logo 2.png" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
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
