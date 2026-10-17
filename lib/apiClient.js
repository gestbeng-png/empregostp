export function apiMessage(
  data,
  fallback = 'Não foi possível concluir o pedido.',
) {
  if (typeof data?.error?.message === 'string')
    return data.error.message || fallback;
  if (typeof data?.error === 'string') return data.error || fallback;
  return fallback;
}

const DIRECT_PATHS = new Set([
  '/api/workspace',
  '/api/me/organizations',
  '/api/admin/operations',
  '/api/admin/recruitment',
]);
const RESOURCE_PATH =
  /^\/api\/(applications|jobs|interviews|hires|invitations|organizations|bulk-actions)(\/|$)/;

/**
 * Never send credentials to arbitrary URLs. No payload/token logging or persistence.
 * @param {string} path
 * @param {{method?: string, body?: Record<string, unknown>, key?: string, signal?: AbortSignal, file?: boolean}} options
 */
export async function apiRequest(
  path,
  { method = 'GET', body, key, signal, file = false } = {},
) {
  const normalized =
    typeof path === 'string'
      ? new URL(path, 'https://empregostp.invalid')
      : null;
  if (
    !normalized ||
    !path.startsWith('/api/') ||
    normalized.origin !== 'https://empregostp.invalid' ||
    normalized.hash ||
    path !== normalized.pathname + normalized.search ||
    (!DIRECT_PATHS.has(normalized.pathname) &&
      !RESOURCE_PATH.test(normalized.pathname))
  ) {
    throw new Error('Destino de API inválido.');
  }
  const { auth } = await import('./firebaseAuth');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Inicie sessão para continuar.');
  const response = await fetch(path, {
    method,
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body
      ? {
          body: JSON.stringify({
            ...body,
            ...(key ? { idempotencyKey: key } : {}),
          }),
        }
      : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(apiMessage(data));
    error.code = data?.error?.code || data?.code || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return file ? response.blob() : response.json();
}

export function downloadCalendar(blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'entrevista-empregostp.ics';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeSignedUrl(value) {
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
