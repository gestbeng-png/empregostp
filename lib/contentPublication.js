import { parseJobCloseDate } from './jobExpiration';

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

/**
 * Data opcional a partir da qual o conteúdo deixa de aparecer.
 *
 * Reutiliza o parser das vagas: aceita Timestamp, Date ou string e uma data
 * sem hora ("2026-02-03") vale até ao fim desse dia.
 */
export function parseContentExpiry(value) {
  return parseJobCloseDate(value);
}

export function isContentExpired(expiresAt, now = new Date()) {
  const end = parseContentExpiry(expiresAt);
  if (!end) return false;
  return end.getTime() < now.getTime();
}

// Conteúdo visível ao público: publicado e ainda dentro do prazo de exibição.
export function isContentVisible({ status, expiresAt } = {}, now = new Date()) {
  return isContentPublished(status) && !isContentExpired(expiresAt, now);
}
