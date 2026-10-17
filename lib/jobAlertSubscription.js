import crypto from 'crypto';

const DEFAULT_SITE_URL = 'https://empregostp.com';
const FILTER_FIELDS = [
  'search',
  'localizacao',
  'tipoContrato',
  'categoria',
  'modalidade',
  'experiencia',
];

function normalizeFilterText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildJobAlertFilterKey(filters = {}) {
  const normalized = Object.fromEntries(
    FILTER_FIELDS.map((field) => [field, normalizeFilterText(filters[field])]),
  );
  normalized.minSalary = Number.isFinite(Number(filters.minSalary))
    ? Math.max(0, Math.round(Number(filters.minSalary)))
    : 0;
  return JSON.stringify(normalized);
}

export function buildJobAlertId(email, filters = {}) {
  const identity = `${String(email || '')
    .trim()
    .toLowerCase()}\n${buildJobAlertFilterKey(filters)}`;
  return crypto.createHash('sha256').update(identity).digest('hex');
}

export function findEquivalentActiveJobAlert(docs = [], filters = {}) {
  const targetKey = buildJobAlertFilterKey(filters);
  return (
    docs.find((doc) => {
      const data = doc.data?.() || {};
      if (data.active === false || data.status === 'unsubscribed') return false;
      const storedKey =
        data.filterKey || buildJobAlertFilterKey(data.filters || {});
      return storedKey === targetKey;
    }) || null
  );
}

export function createJobAlertUnsubscribeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashJobAlertUnsubscribeToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''))
    .digest('hex');
}

export function isValidJobAlertUnsubscribeToken(token, expectedHash) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return false;
  }
  if (
    typeof expectedHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(expectedHash)
  ) {
    return false;
  }

  const actual = Buffer.from(hashJobAlertUnsubscribeToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

// Cada email de alerta leva um link com token próprio (lib/jobAlertDelivery.js);
// o cancelamento aceita o token da subscrição e o de qualquer envio recente.
export function isValidUnsubscribeTokenForAlert(token, alert = {}) {
  const hashes = [
    alert.unsubscribeTokenHash,
    ...(Array.isArray(alert.unsubscribeTokenHashes)
      ? alert.unsubscribeTokenHashes
      : []),
  ].filter(Boolean);
  return hashes.some((hash) => isValidJobAlertUnsubscribeToken(token, hash));
}

export function getCanonicalJobAlertSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  try {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol)) return DEFAULT_SITE_URL;
    if (parsed.username || parsed.password) return DEFAULT_SITE_URL;
    return parsed.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function buildJobAlertUnsubscribeUrl(
  alertId,
  token,
  siteUrl = getCanonicalJobAlertSiteUrl(),
) {
  const url = new URL('/alertas/cancelar', `${siteUrl.replace(/\/$/, '')}/`);
  url.hash = new URLSearchParams({
    alert: String(alertId),
    token: String(token),
  }).toString();
  return url.toString();
}
