/**
 * E12/D6/H3 — regras da equipa de uma organização. Puras.
 *
 * - Quem convida atribui papel ≤ ao seu; ADMIN nunca cria OWNER; RECRUITER e
 *   REVIEWER não convidam.
 * - Exatamente 1 OWNER ativo; a propriedade só muda por transferência para
 *   um ADMIN ativo, que a aceita; o antigo OWNER passa a ADMIN.
 * - O OWNER nunca perde acesso por limite de lugares (E11).
 */
import type { MEMBERSHIP_ROLES } from './Membership';

export type MemberRole = (typeof MEMBERSHIP_ROLES)[number];
export const INVITABLE_ROLES: readonly MemberRole[] = [
  'ADMIN',
  'RECRUITER',
  'REVIEWER',
];
const RANK: Readonly<Record<MemberRole, number>> = {
  OWNER: 4,
  ADMIN: 3,
  RECRUITER: 2,
  REVIEWER: 1,
};
export const INVITATION_TTL_MS = 7 * 86_400_000;

export function canAssignRole(actor: MemberRole, target: MemberRole): boolean {
  if (actor !== 'OWNER' && actor !== 'ADMIN') return false;
  if (target === 'OWNER') return false;
  return RANK[target] <= RANK[actor];
}

/** Remover/alterar um membro: nunca o OWNER; ADMIN só até ADMIN; nunca a si próprio. */
export function canManageMember(
  actor: { userId: string; role: MemberRole },
  member: { userId: string; role: MemberRole },
): boolean {
  if (actor.userId === member.userId || member.role === 'OWNER') return false;
  if (actor.role === 'OWNER') return true;
  return actor.role === 'ADMIN' && RANK[member.role] <= RANK.ADMIN;
}

/** Lugares: membros ativos + convites pendentes. O OWNER conta mas nunca sai. */
export function seatsAvailable(input: {
  activeMembers: number;
  pendingInvitations: number;
  limit: number | null;
}): boolean {
  return (
    input.limit === null ||
    input.activeMembers + input.pendingInvitations < input.limit
  );
}

/** E11: acima do limite, os membros mais recentes (exceto o OWNER) ficam só leitura. */
export function readOnlyMembers(
  members: readonly { userId: string; role: MemberRole; joinedAtMs: number }[],
  limit: number | null,
): string[] {
  if (limit === null) return [];
  const ordered = [...members].sort((a, b) =>
    a.role === 'OWNER'
      ? -1
      : b.role === 'OWNER'
        ? 1
        : a.joinedAtMs - b.joinedAtMs,
  );
  return ordered
    .slice(Math.max(limit, 1))
    .filter((m) => m.role !== 'OWNER')
    .map((m) => m.userId);
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
    ? email
    : null;
}
