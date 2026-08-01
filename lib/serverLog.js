const EVENT_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

const ERROR_NAMESPACE_CATEGORIES = Object.freeze({
  'app/': 'application',
  'auth/': 'authentication',
  'firestore/': 'firestore',
  'messaging/': 'messaging',
  'storage/': 'storage',
});

function normalizeEvent(event) {
  const value = typeof event === 'string' ? event.trim() : '';
  if (value.length <= 80 && EVENT_PATTERN.test(value)) return value;
  return 'server.unclassified_error';
}

export function getSafeErrorMetadata(error) {
  const rawCode = error?.code;

  if (typeof rawCode === 'number' && Number.isFinite(rawCode)) {
    return Object.freeze({ category: 'service' });
  }

  if (typeof rawCode !== 'string') {
    return Object.freeze({ category: 'unexpected' });
  }

  for (const [prefix, category] of Object.entries(ERROR_NAMESPACE_CATEGORIES)) {
    if (rawCode.startsWith(prefix)) {
      return Object.freeze({ category });
    }
  }

  if (/^(?:ERR_|E)[A-Z0-9_]{2,63}$/.test(rawCode)) {
    return Object.freeze({ category: 'runtime' });
  }

  if (/^[A-Z][A-Z0-9_]{2,63}$/.test(rawCode)) {
    return Object.freeze({ category: 'business_rule' });
  }

  return Object.freeze({ category: 'unexpected' });
}

export function logServerError(event, error) {
  console.error(normalizeEvent(event), getSafeErrorMetadata(error));
}

export function logServerWarning(event, error) {
  console.warn(normalizeEvent(event), getSafeErrorMetadata(error));
}
