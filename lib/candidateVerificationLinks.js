export const MAX_COMPETENCY_LINKS = 10;
export const MAX_COMPETENCY_LINK_DESCRIPTION = 500;
export const MAX_COMPETENCY_LINK_URL = 2000;

// Shared by the form and API so every accepted description stays paired
// with its URL. Empty, unused rows do not become evidence.
/** @param {unknown} [value] */
export function validateCompetencyLinks(value = []) {
  const fail = (error) => ({ links: [], error });
  if (!Array.isArray(value) || value.length > MAX_COMPETENCY_LINKS) {
    return fail(`Adicione no máximo ${MAX_COMPETENCY_LINKS} links de prova.`);
  }

  const links = [];
  const seen = new Set();
  for (const [index, entry] of value.entries()) {
    if (
      !entry ||
      typeof entry.url !== 'string' ||
      (entry.description !== undefined && typeof entry.description !== 'string')
    ) {
      return fail(`Preencha um link válido na prova ${index + 1}.`);
    }
    const url = entry.url.trim();
    const description = (entry.description || '').trim();
    if (!url && !description) continue;
    if (!url)
      return fail(
        `Adicione o link da prova ${index + 1} ou remova a descrição.`,
      );
    if (
      url.length > MAX_COMPETENCY_LINK_URL ||
      description.length > MAX_COMPETENCY_LINK_DESCRIPTION
    ) {
      return fail(
        `Cada link pode ter até ${MAX_COMPETENCY_LINK_URL} caracteres e a descrição até ${MAX_COMPETENCY_LINK_DESCRIPTION}.`,
      );
    }
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
      if (seen.has(parsed.href)) {
        return fail(`O link da prova ${index + 1} já foi adicionado.`);
      }
      seen.add(parsed.href);
    } catch {
      return fail(
        `Introduza um link completo válido na prova ${index + 1} (https://…).`,
      );
    }
    links.push({ url, description });
  }
  return { links, error: '' };
}
