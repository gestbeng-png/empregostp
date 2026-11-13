import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('public/sw.js', 'utf8');
function runtime() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cache = {
    put: jest.fn(),
    match: jest.fn().mockResolvedValue('old-private-html'),
  };
  const fetch = jest.fn().mockResolvedValue({ status: 200 });
  const caches = {
    open: jest.fn().mockResolvedValue(cache),
    match: jest.fn(),
    keys: jest.fn(),
    delete: jest.fn().mockResolvedValue(true),
  };
  vm.runInNewContext(source, {
    URL,
    fetch,
    caches,
    self: {
      location: { origin: 'https://test.st', hostname: 'test.st' },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners[type] = handler;
      },
      clients: { claim: jest.fn() },
    },
  });
  return { listeners, cache, fetch, caches };
}

test.each([
  '/dashboard',
  '/dashboard/candidato',
  '/dashboard/candidato?tab=profile',
  '/dashboard/empresa/vaga/criar-vaga',
  '/dashboard/admin/users',
  '/candidatos/synthetic-candidate',
  '/candidatos/synthetic-candidate?source=verified',
  '/profile',
  '/premium/candidatos',
  '/_next/data/build/dashboard/candidato.json',
  '/_next/data/build/premium/empresa.json',
])(
  '%s nunca lê nem grava uma página de outra sessão em cache',
  async (path) => {
    const { listeners, fetch, caches } = runtime();
    const request = {
      method: 'GET',
      url: `https://test.st${path}`,
      mode: path.endsWith('.json') ? 'cors' : 'navigate',
    };
    const respondWith = jest.fn();
    listeners.fetch?.({ request, respondWith });
    await respondWith.mock.calls[0][0];
    expect(fetch).toHaveBeenCalledWith(request, { cache: 'no-store' });
    expect(caches.open).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  },
);

test('offline não recupera um dashboard antigo', async () => {
  const { listeners, fetch, caches } = runtime();
  fetch.mockRejectedValue(new Error('offline'));
  const respondWith = jest.fn();
  listeners.fetch?.({
    request: {
      method: 'GET',
      url: 'https://test.st/dashboard/candidato',
      mode: 'navigate',
    },
    respondWith,
  });
  await expect(respondWith.mock.calls[0][0]).rejects.toThrow('offline');
  expect(caches.open).not.toHaveBeenCalled();
});

test('atualização elimina caches privados antigos sem apagar caches de outras aplicações', async () => {
  const { listeners, caches } = runtime();
  caches.keys.mockResolvedValue([
    'empregostp-dashboard-v2',
    'empregostp-static-v2',
    'empregostp-static-v3',
    'another-app',
  ]);
  const waitUntil = jest.fn();
  listeners.activate?.({ waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(caches.delete.mock.calls).toEqual([
    ['empregostp-dashboard-v2'],
    ['empregostp-static-v2'],
  ]);
});
