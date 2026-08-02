/**
 * Normaliza links externos introduzidos por utilizadores e rejeita esquemas
 * executáveis (javascript:, data:, file:, etc.).
 */
export function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}
