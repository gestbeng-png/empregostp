try {
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');
  importScripts('/firebase-sw-config.js');

  if (!self.__EMPREGOSTP_FIREBASE_CONFIG__) {
    throw new Error('Configuração Firebase do service worker indisponível');
  }

  firebase.initializeApp(self.__EMPREGOSTP_FIREBASE_CONFIG__);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || payload?.data?.title || 'EmpregoSTP';
    const body = payload?.notification?.body || payload?.data?.message || 'Nova atualização disponível.';
    const actionUrl = payload?.data?.actionUrl || '/';

    self.registration.showNotification(title, {
      body,
      icon: '/assets/Emprego STP Logo.png',
      badge: '/assets/Emprego STP Logo.png',
      data: {
        actionUrl,
        relatedId: payload?.data?.relatedId || null,
        relatedType: payload?.data?.relatedType || null
      }
    });
  });
} catch (error) {
  // Push messaging remains best effort; caching still works without FCM bootstrap.
}

const STATIC_CACHE = 'empregostp-static-v3';
const PAGES_CACHE = 'empregostp-pages-v3';
const OFFLINE_URL = '/offline';
const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.webmanifest',
  '/Logo.svg',
  '/assets/Emprego STP Logo.png'
];

function isStaticAsset(pathname) {
  return pathname.startsWith('/_next/static/') || /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(pathname);
}

function shouldBypassRequest(pathname) {
  if (pathname.startsWith('/_next/static/chunks/')) return true;
  if (pathname.startsWith('/_next/webpack-hmr')) return true;
  if (self.location.hostname === 'localhost' && pathname.startsWith('/_next/')) return true;
  return false;
}

function isApiRequest(pathname) {
  return pathname.startsWith('/api/');
}

function isCriticalPublicPage(pathname) {
  return pathname === '/vagas' || pathname.startsWith('/vaga/');
}

function isPrivatePage(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/candidatos/') ||
    pathname === '/profile' || pathname === '/premium' || pathname.startsWith('/premium/') ||
    pathname === '/recursos/gerador-cv';
}

async function networkFirst(request, cacheName, fallbackToOffline = true) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 &&
        !/no-store|private/i.test(response.headers.get('Cache-Control') || '') &&
        !isPrivatePage(new URL(response.url || request.url).pathname)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return fallbackToOffline ? caches.match(OFFLINE_URL) : Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}

async function clearAuthCaches() {
  await caches.delete('empregostp-dashboard-v2');
  // Limpa igualmente dados Next que versões antigas tratavam como assets.
  for (const name of [PAGES_CACHE, STATIC_CACHE]) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    await Promise.all(requests.filter((request) => {
      const pathname = new URL(request.url).pathname;
      return isPrivatePage(pathname) || pathname.startsWith('/_next/data/');
    }).map((request) => cache.delete(request)));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('empregostp-') && ![STATIC_CACHE, PAGES_CACHE].includes(key)).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_AUTH_CACHES') {
    event.waitUntil(clearAuthCaches());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification?.data?.actionUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(actionUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
      return undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (isApiRequest(requestUrl.pathname)) return;
  // Nunca reutilizar HTML/JSON de uma conta anterior, nem sequer offline.
  // O pedido deve sempre passar pela autorização do servidor.
  if (isPrivatePage(requestUrl.pathname) || requestUrl.pathname.startsWith('/_next/data/')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  if (shouldBypassRequest(requestUrl.pathname)) return;

  if (event.request.mode === 'navigate') {
    if (isCriticalPublicPage(requestUrl.pathname)) {
      event.respondWith(networkFirst(event.request, PAGES_CACHE, true));
      return;
    }

    event.respondWith(networkFirst(event.request, PAGES_CACHE, true));
    return;
  }

  if (isStaticAsset(requestUrl.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
  }
});
