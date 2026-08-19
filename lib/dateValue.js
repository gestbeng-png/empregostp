/**
 * Converte os formatos de data usados no projeto (ISO, Date e Timestamp do
 * Firestore) numa Date válida. Nunca lança para dados legados malformados.
 */
export function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return null;

  try {
    let parsed;
    if (value instanceof Date) {
      parsed = new Date(value.getTime());
    } else if (typeof value?.toDate === 'function') {
      parsed = value.toDate();
    } else if (typeof value?.toMillis === 'function') {
      parsed = new Date(value.toMillis());
    } else if (
      typeof value === 'object' &&
      Number.isFinite(Number(value.seconds ?? value._seconds))
    ) {
      const seconds = Number(value.seconds ?? value._seconds);
      const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds) || 0;
      parsed = new Date(seconds * 1000 + Math.floor(nanoseconds / 1e6));
    } else if (typeof value === 'string' || typeof value === 'number') {
      parsed = new Date(value);
    } else {
      return null;
    }

    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}
