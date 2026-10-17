const BLOCKED_ACCOUNT_STATUSES = new Set([
  // Conta eliminada pelo titular (H5): só resta o registo anonimizado.
  'deleted',
  'disabled',
  'inactive',
  'suspended',
]);

export const BLOCKED_ACCOUNT_MESSAGE =
  'Esta conta está suspensa ou inativa. Contacte o suporte para recuperar o acesso.';

export function normalizeAccountStatus(status) {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

/**
 * Perfis antigos não têm `status`; continuam ativos por compatibilidade.
 * Só os estados administrativos explicitamente bloqueados negam acesso.
 */
export function isUserAccountActive(userData) {
  if (!userData || typeof userData !== 'object') return false;
  return !BLOCKED_ACCOUNT_STATUSES.has(
    normalizeAccountStatus(userData.status),
  );
}
