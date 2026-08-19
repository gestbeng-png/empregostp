export const FORM_DRAFT_SCHEMA = 'empregostp.form-draft';
export const FORM_DRAFT_VERSION = 1;
export const DEFAULT_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DRAFT_CLEAR_MARKER_SUFFIX = ':cleared';

const SENSITIVE_KEYS = new Set([
  'accesstoken',
  'authorization',
  'credential',
  'idtoken',
  'passphrase',
  'password',
  'privatekey',
  'refreshtoken',
  'secret',
  'token',
]);
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSensitiveKey(key) {
  const normalized = String(key || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  return SENSITIVE_KEYS.has(normalized);
}

function isBinaryValue(value) {
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return false;
}

export function sanitizeDraftValue(value, options = {}, depth = 0) {
  const {
    allowDataUrls = false,
    maxDataUrlLength = 750_000,
    maxDepth = 10,
    omitKeys = [],
  } = options;

  if (depth > maxDepth || value === undefined || typeof value === 'function') {
    return undefined;
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  if (typeof value === 'string') {
    if (/^data:/i.test(value)) {
      return allowDataUrls && value.length <= maxDataUrlLength
        ? value
        : undefined;
    }
    return value;
  }

  if (isBinaryValue(value)) return undefined;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeDraftValue(item, options, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const omitted = new Set(omitKeys.map((key) => String(key).toLowerCase()));
    const result = {};

    Object.entries(value).forEach(([key, currentValue]) => {
      if (
        isSensitiveKey(key) ||
        UNSAFE_OBJECT_KEYS.has(key) ||
        omitted.has(String(key).toLowerCase())
      ) {
        return;
      }

      const sanitized = sanitizeDraftValue(currentValue, options, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    });

    return result;
  }

  return undefined;
}

export function createFormDraftKey({
  scope,
  ownerId,
  resourceId = 'default',
  version = FORM_DRAFT_VERSION,
}) {
  if (!scope || !ownerId) return '';
  return [
    'empregostp',
    'draft',
    `v${version}`,
    encodeURIComponent(String(scope)),
    encodeURIComponent(String(ownerId)),
    encodeURIComponent(String(resourceId || 'default')),
  ].join(':');
}

export function buildStoredDraft(
  data,
  {
    version = FORM_DRAFT_VERSION,
    ttlMs = DEFAULT_DRAFT_TTL_MS,
    now = Date.now(),
    omitKeys = [],
    allowDataUrls = false,
    maxDataUrlLength = 750_000,
  } = {},
) {
  const sanitized = sanitizeDraftValue(data, {
    allowDataUrls,
    maxDataUrlLength,
    omitKeys,
  });
  const savedAt = new Date(now).toISOString();

  return {
    schema: FORM_DRAFT_SCHEMA,
    version,
    savedAt,
    expiresAt: new Date(now + ttlMs).toISOString(),
    data: sanitized,
  };
}

function parseDate(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * @param {string | object} rawValue
 * @param {{ version?: number, now?: number, migrate?: (draft: any) => any }} [options]
 */
export function parseStoredDraft(
  rawValue,
  {
    version = FORM_DRAFT_VERSION,
    now = Date.now(),
    migrate,
  } = {},
) {
  if (!rawValue) return null;

  let parsed;
  try {
    parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
  } catch {
    return null;
  }

  if (
    parsed?.schema === FORM_DRAFT_SCHEMA &&
    parsed?.version === version &&
    parsed?.data !== undefined
  ) {
    const expiresAt = parseDate(parsed.expiresAt);
    if (expiresAt && expiresAt <= now) return null;

    return {
      data: parsed.data,
      savedAt: parsed.savedAt || '',
      savedAtMs: parseDate(parsed.savedAt),
      expiresAt: parsed.expiresAt || '',
      source: 'current',
    };
  }

  if (typeof migrate !== 'function') return null;

  try {
    const migrated = migrate(parsed);
    if (migrated === null || migrated === undefined) return null;
    const savedAt = parsed?.savedAt || new Date(now).toISOString();

    return {
      data: sanitizeDraftValue(migrated),
      savedAt,
      savedAtMs: parseDate(savedAt),
      expiresAt: '',
      source: 'legacy',
    };
  } catch {
    return null;
  }
}

export function readLocalDraft(storage, key, options) {
  if (!storage || !key) return null;
  try {
    const draft = parseStoredDraft(storage.getItem(key), options);
    const clearedAtMs = readLocalDraftClearedAt(storage, key);
    if (draft?.savedAtMs && clearedAtMs && draft.savedAtMs <= clearedAtMs) {
      storage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function writeLocalDraft(storage, key, data, options) {
  if (!storage || !key) return null;
  const envelope = buildStoredDraft(data, options);
  storage.setItem(key, JSON.stringify(envelope));
  removeLocalDraftClearMarker(storage, key);
  return envelope;
}

export function removeLocalDraft(storage, key) {
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {
    // Storage can be disabled or unavailable in private browsing.
  }
}

export function readLocalDraftClearedAt(storage, key) {
  if (!storage || !key) return 0;
  try {
    return parseDate(storage.getItem(`${key}${DRAFT_CLEAR_MARKER_SUFFIX}`));
  } catch {
    return 0;
  }
}

export function writeLocalDraftClearMarker(
  storage,
  key,
  clearedAt = new Date().toISOString(),
) {
  if (!storage || !key) return '';
  try {
    const normalized = new Date(clearedAt).toISOString();
    storage.setItem(`${key}${DRAFT_CLEAR_MARKER_SUFFIX}`, normalized);
    return normalized;
  } catch {
    return '';
  }
}

export function removeLocalDraftClearMarker(storage, key) {
  if (!storage || !key) return;
  try {
    storage.removeItem(`${key}${DRAFT_CLEAR_MARKER_SUFFIX}`);
  } catch {
    // Storage can be disabled or unavailable in private browsing.
  }
}
