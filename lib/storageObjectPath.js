const FIREBASE_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

// `/v0/b/{bucket}/o/{objectPath}` — o caminho vem percent-encoded.
const OBJECT_URL_PATTERN = /^\/v0\/b\/[^/]+\/o\/(.+)$/;

function isSafeObjectPath(path) {
  if (!path || typeof path !== 'string') return false;
  if (path.startsWith('/') || path.includes('//')) return false;
  // Travessia de diretórios nunca é legítima num caminho de objeto e podia
  // saltar do diretório do dono para outra área do bucket.
  return !path.split('/').some((segment) => segment === '.' || segment === '..');
}

/**
 * Devolve o caminho do objeto no bucket a partir de um download URL do
 * Firebase Storage, ou de um caminho já em formato simples.
 *
 * Devolve `null` para qualquer coisa que não seja comprovadamente um objeto
 * do nosso Storage — host estranho, URL malformado ou travessia de diretórios.
 */
export function extractStorageObjectPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return isSafeObjectPath(trimmed) ? trimmed : null;
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch (error) {
    return null;
  }

  if (!FIREBASE_STORAGE_HOSTS.has(url.hostname)) return null;

  const match = OBJECT_URL_PATTERN.exec(url.pathname);
  if (!match) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch (error) {
    return null;
  }

  return isSafeObjectPath(decoded) ? decoded : null;
}

/**
 * Confirma que o caminho está dentro de `{prefix}/{ownerUid}/` e aponta para
 * um ficheiro concreto.
 */
export function isPathOwnedBy(path, prefix, ownerUid) {
  if (!isSafeObjectPath(path) || !prefix || !ownerUid) return false;
  const expected = `${prefix}/${ownerUid}/`;
  return path.startsWith(expected) && path.length > expected.length;
}

/**
 * Resolve o caminho de um objeto que tem de pertencer a `ownerUid`.
 *
 * Existe porque valores como `users/{uid}.cvUrl` foram gravados a partir de
 * input do cliente: sem esta verificação, um URL forjado apontando para o
 * ficheiro de outra pessoa (ou para `payment-proofs/`) seria assinado pelo
 * servidor como se fosse do próprio.
 */
export function resolveOwnedStorageObjectPath({ ownerUid, prefix, value }) {
  const path = extractStorageObjectPath(value);
  if (!path) return null;

  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  return prefixes.some((candidate) => isPathOwnedBy(path, candidate, ownerUid))
    ? path
    : null;
}
