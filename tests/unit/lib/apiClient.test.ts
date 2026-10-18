import { apiMessage, safeSignedUrl, apiRequest } from '@/lib/apiClient';

const mockToken = jest.fn();
let mockCurrentUser: { getIdToken: typeof mockToken } | null;
jest.mock('@/lib/firebaseAuth', () => ({
  auth: {
    get currentUser() {
      return mockCurrentUser;
    },
  },
}));
const originalFetch = global.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  mockCurrentUser = { getIdToken: mockToken };
  mockToken.mockReset().mockResolvedValue('synthetic-token');
  mockFetch
    .mockReset()
    .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

test.each([
  'https://foreign.test/api/applications',
  '//foreign.test/api/workspace',
  '/api/../admin/users',
  '/api/workspace#secret',
  '/api/profile',
  '/api/v2/workspace',
  '/api/organizations-other',
  '/api/workspace/../admin/operations',
  '/api/applications/%2e%2e/admin/operations',
  '/api/applications\\a',
  'https://empregostp.invalid/api/workspace',
])('does not send credentials to disallowed destination %s', async (path) => {
  await expect(apiRequest(path)).rejects.toThrow('Destino de API inválido');
  expect(mockToken).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
});
test('requires a restored authenticated user', async () => {
  mockCurrentUser = null;
  await expect(apiRequest('/api/workspace')).rejects.toThrow('Inicie sessão');
  expect(mockFetch).not.toHaveBeenCalled();
});
test.each([
  '/api/workspace?organizationId=org',
  '/api/me/organizations',
  '/api/admin/operations',
  '/api/admin/recruitment',
  '/api/jobs/job/close',
  '/api/bulk-actions',
  '/api/invitations/invite/preview',
  '/api/organizations/org/members/member',
  '/api/hires/hire/confirm',
])('uses the consolidated authenticated route %s', async (path) => {
  await expect(apiRequest(path)).resolves.toEqual({ ok: true });
  expect(mockFetch).toHaveBeenCalledWith(path, expect.anything());
});
test('obtains a fresh token, sends matching header/body idempotency and never caches', async () => {
  const signal = new AbortController().signal;
  await apiRequest('/api/applications/a/interviews', {
    method: 'POST',
    body: { type: 'VIDEO' },
    key: 'synthetic-key',
    signal,
  });
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/applications/a/interviews',
    expect.objectContaining({
      method: 'POST',
      signal,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Authorization: 'Bearer synthetic-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'synthetic-key',
      },
      body: JSON.stringify({ type: 'VIDEO', idempotencyKey: 'synthetic-key' }),
    }),
  );
});
test.each([
  { error: { code: 'CONFLICT', message: 'Versão alterada.' } },
  { error: 'Versão alterada.', code: 'CONFLICT' },
])('preserves actionable server failure %j', async (body) => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => body,
  });
  await expect(apiRequest('/api/workspace')).rejects.toMatchObject({
    message: 'Versão alterada.',
    status: 409,
    code: 'CONFLICT',
  });
});
test('returns raw authenticated calendar files, not parsed JSON', async () => {
  const blob = new Blob(['BEGIN:VCALENDAR']);
  mockFetch.mockResolvedValue({ ok: true, blob: async () => blob });
  expect(await apiRequest('/api/interviews/i/ics', { file: true })).toBe(blob);
});
test('accepts only HTTPS links and uses a generic non-sensitive error fallback', () => {
  expect(safeSignedUrl('https://storage.test/cv?signature=x')).toBe(
    'https://storage.test/cv?signature=x',
  );
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,x',
    'http://storage.test/cv',
    '/cv',
  ])
    expect(safeSignedUrl(url)).toBeNull();
  expect(apiMessage({ code: 'INTERNAL' })).toBe(
    'Não foi possível concluir o pedido.',
  );
});
