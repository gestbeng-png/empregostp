import '../styles/globals.css';
import '../styles/dashboard-shell.css';
import '../styles/workbridge-theme.css';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthProvider } from '../context/AuthContext';
// Ambos são interface que só aparece depois de um evento do browser (prompt de
// instalação) ou de permissão concedida (push). Não precisam de SSR nem de
// estar no bundle inicial de todas as páginas.
const PwaInstallPrompt = dynamic(
  () => import('../components/PwaInstallPrompt'),
  { ssr: false },
);
const WebPushManager = dynamic(() => import('../components/WebPushManager'), {
  ssr: false,
});
import Head from 'next/head';
import DashboardRouteFrame from '../components/dashboard/DashboardRouteFrame';

const AUTH_ROUTES = new Set([
  '/escolha-tipo',
  '/login',
  '/recuperar-senha',
  '/redefinir-senha',
  '/register',
  '/verificar-email',
]);

const LEGAL_ROUTES = new Set(['/cookies', '/politica-privacidade', '/termos']);

function getWorkbridgePageKey(pathname) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname === '/profile') return 'dashboard';
  if (AUTH_ROUTES.has(pathname)) return 'auth';
  if (LEGAL_ROUTES.has(pathname)) return 'legal';
  if (pathname === '/vagas') return 'jobs';
  if (pathname.startsWith('/vaga/')) return 'job-detail';
  if (pathname === '/candidatos' || pathname.startsWith('/candidatos/')) {
    return pathname === '/candidatos/[id]' ? 'candidate-detail' : 'candidates';
  }
  if (pathname === '/empresas') return 'companies';
  if (pathname === '/sobre-nos') return 'about';
  if (pathname === '/carreira') return 'career';
  if (pathname === '/blog') return 'blog';
  if (pathname.startsWith('/blog/')) return 'article';
  if (pathname === '/premium' || pathname.startsWith('/premium/')) {
    return 'pricing';
  }
  if (pathname === '/recursos') return 'resources';
  if (pathname.startsWith('/recursos/guia/')) return 'article';
  if (pathname.startsWith('/recursos/')) return 'tool';
  return 'public';
}

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const pathname = router.pathname || '';
  const pageKey = getWorkbridgePageKey(pathname);
  const isHome = pageKey === 'home';
  const routeKind =
    pageKey === 'dashboard'
      ? 'dashboard'
      : pageKey === 'auth'
        ? 'auth'
        : 'public';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!('serviceWorker' in navigator)) return undefined;

    if (process.env.NODE_ENV !== 'production') {
      const cleanupDevServiceWorker = async () => {
        try {
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map((registration) => registration.unregister()),
          );
        } catch (error) {
          // Keep development mode resilient even if SW cleanup fails.
        }

        if ('caches' in window) {
          try {
            const cacheKeys = await caches.keys();
            await Promise.all(
              cacheKeys.map((cacheKey) => caches.delete(cacheKey)),
            );
          } catch (error) {
            // Best effort cache cleanup.
          }
        }
      };

      cleanupDevServiceWorker();
      return undefined;
    }

    const registerWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        // Non-blocking: the app should still work without offline cache.
      }
    };

    registerWorker();
    return undefined;
  }, []);

  return (
    <AuthProvider>
      <div
        className={
          isHome
            ? undefined
            : `workbridgeRoute workbridge${routeKind
                .charAt(0)
                .toUpperCase()}${routeKind.slice(1)}Route`
        }
        data-workbridge-page={isHome ? undefined : pageKey}
      >
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#102441" />
          <meta name="application-name" content="EmpregoSTP" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="default"
          />
          <meta name="apple-mobile-web-app-title" content="EmpregoSTP" />
          <link rel="manifest" href="/manifest.webmanifest" />
          <link rel="apple-touch-icon" href="/assets/Emprego STP Logo 2.png" />
        </Head>
        <PwaInstallPrompt />
        <WebPushManager />
        <DashboardRouteFrame Component={Component} pageProps={pageProps} />
      </div>
    </AuthProvider>
  );
}

export default MyApp;
