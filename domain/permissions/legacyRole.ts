import type { PermissionRole } from './can';

/**
 * Papel de permissão a partir da conta legada (D2: `userType` mantém-se para
 * candidato/admin; a conta de empresa é a OWNER da sua organização até à
 * migração para `OrganizationMembership`). Desconhecido → NONE (nega tudo).
 */
export function permissionRoleOf(
  user: Readonly<Record<string, unknown>>,
): PermissionRole {
  if (user.userType === 'admin') return 'ADMIN';
  if (
    user.platformRole === 'MODERATOR' ||
    user.platformRole === 'REVIEWER' ||
    user.platformRole === 'SUPPORT'
  )
    return user.platformRole;
  if (user.userType === 'empresa') return 'OWNER';
  if (user.userType === 'candidato') return 'CANDIDATE';
  return 'NONE';
}
