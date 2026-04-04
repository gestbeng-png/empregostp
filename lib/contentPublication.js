export const CONTENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

export function normalizeContentStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === CONTENT_STATUS.DRAFT) return CONTENT_STATUS.DRAFT;
  return CONTENT_STATUS.PUBLISHED;
}

// Backward compatible: legacy records without status remain publicly visible.
export function isContentPublished(status) {
  return normalizeContentStatus(status) === CONTENT_STATUS.PUBLISHED;
}

export function resolvePublishedAt({ status, publishedAt, fallbackDate = null }) {
  const normalized = normalizeContentStatus(status);
  if (normalized !== CONTENT_STATUS.PUBLISHED) {
    return null;
  }
  if (publishedAt) {
    return publishedAt;
  }
  return fallbackDate;
}
