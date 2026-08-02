export function safeTimestampToMillis(value) {
  if (!value) return 0;

  if (typeof value.toMillis === 'function') {
    try {
      const millis = value.toMillis();
      return Number.isFinite(millis) ? millis : 0;
    } catch (error) {
      return 0;
    }
  }

  if (typeof value.toDate === 'function') {
    try {
      const date = value.toDate();
      if (date instanceof Date) {
        const millis = date.getTime();
        return Number.isFinite(millis) ? millis : 0;
      }
    } catch (error) {
      return 0;
    }
  }

  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

export function safeTimestampToISOString(value) {
  const millis = safeTimestampToMillis(value);
  return millis > 0 ? new Date(millis).toISOString() : null;
}

/**
 * Serializa recursivamente um valor vindo do Firestore num formato aceite pelo
 * `getServerSideProps` do Next.js: Timestamps e Datas passam a strings ISO e
 * `undefined` passa a `null`. Cobre objetos e arrays aninhados, evitando o erro
 * "cannot be serialized as JSON" para qualquer campo de data do documento.
 */
export function serializeForProps(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;

  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (error) {
      return null;
    }
  }

  if (value instanceof Date) return value.toISOString();

  if (
    typeof value._seconds === 'number' &&
    typeof value._nanoseconds === 'number'
  ) {
    return new Date(
      value._seconds * 1000 + Math.floor(value._nanoseconds / 1e6),
    ).toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForProps(item));
  }

  const output = {};
  for (const [key, val] of Object.entries(value)) {
    output[key] = serializeForProps(val);
  }
  return output;
}

export function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    const candidate =
      value.label ?? value.title ?? value.text ?? value.name ?? value.value;
    if (candidate !== null && candidate !== undefined) {
      return String(candidate);
    }
  }

  return fallback;
}
