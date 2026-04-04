import '../styles/globals.css';
import { useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import WebPushManager from '../components/WebPushManager';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!('serviceWorker' in navigator)) return undefined;

    if (process.env.NODE_ENV !== 'production') {
      const cleanupDevServiceWorker = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        } catch (error) {
          // Keep development mode resilient even if SW cleanup fails.
        }

        if ('caches' in window) {
          try {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="application-name" content="EmpregoSTP" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EmpregoSTP" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/assets/Emprego STP Logo.png" />
      </Head>
      <PwaInstallPrompt />
      <WebPushManager />
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;
