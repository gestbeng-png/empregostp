/**
 * R7/R8/R14/R15/R63 — equipa de um recrutamento. Puro.
 *
 * A pertença à organização (OrganizationMembership) diz quem é da empresa; a
 * equipa do recrutamento diz quem participa NESTA vaga e com que função. As
 * duas nunca se substituem: só membros ativos entram numa equipa, e sair da
 * organização tira a pessoa de todas as equipas.
 *
 * - No máximo 1 responsável (LEAD_RECRUITER) e 1 Hiring Manager.
 * - Cada pessoa tem uma única função por recrutamento.
 * - OWNER/ADMIN gerem qualquer equipa; o responsável atual pode gerir a da
 *   sua vaga (inclui transferir a responsabilidade — R14).
 */
import type { MemberRole } from '../memberships/teamRules';
import { failure, success } from '../shared/Result';
import type { Result } from '../shared/Result';

export const HIRING_TEAM_ROLES = [
  'LEAD_RECRUITER',
  'RECRUITER',
  'HIRING_MANAGER',
  'INTERVIEWER',
  'OBSERVER',
] as const;
export type HiringTeamRole = (typeof HIRING_TEAM_ROLES)[number];

export const HIRING_TEAM_ROLE_LABELS: Readonly<Record<HiringTeamRole, string>> =
  {
    LEAD_RECRUITER: 'Responsável',
    RECRUITER: 'Recrutador',
    HIRING_MANAGER: 'Hiring Manager',
    INTERVIEWER: 'Entrevistador',
    OBSERVER: 'Observador',
  };

/** Limite simples para uma equipa de vaga (STP: equipas pequenas). */
export const MAX_HIRING_TEAM_SIZE = 20;

export interface HiringTeamMember {
  userId: string;
  role: HiringTeamRole;
}

export interface HiringTeamInput {
  leadRecruiterId?: unknown;
  hiringManagerId?: unknown;
  recruiterIds?: unknown;
  interviewerIds?: unknown;
  observerIds?: unknown;
}

export interface HiringTeam {
  leadRecruiterId: string | null;
  hiringManagerId: string | null;
  members: HiringTeamMember[];
  /** Todos os participantes — usado para dar acesso à vaga. */
  memberIds: string[];
}

const id = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const ids = (value: unknown): string[] | null => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    const clean = id(item);
    if (!clean) return null;
    out.push(clean);
  }
  return out;
};

/**
 * Valida e normaliza a equipa pedida contra os membros ativos da organização.
 * Rejeita (não corrige em silêncio) quem não é membro ou aparece em duas
 * funções — uma escolha ambígua tem de voltar a quem a fez.
 */
export function buildHiringTeam(
  input: HiringTeamInput,
  activeMemberIds: ReadonlySet<string>,
): Result<HiringTeam> {
  const lead = input.leadRecruiterId == null ? null : id(input.leadRecruiterId);
  const manager =
    input.hiringManagerId == null ? null : id(input.hiringManagerId);
  if (input.leadRecruiterId != null && input.leadRecruiterId !== '' && !lead)
    return failure('INVALID_INPUT');
  if (input.hiringManagerId != null && input.hiringManagerId !== '' && !manager)
    return failure('INVALID_INPUT');
  const recruiters = ids(input.recruiterIds);
  const interviewers = ids(input.interviewerIds);
  const observers = ids(input.observerIds);
  if (!recruiters || !interviewers || !observers)
    return failure('INVALID_INPUT');

  const members: HiringTeamMember[] = [
    ...(lead ? [{ userId: lead, role: 'LEAD_RECRUITER' as const }] : []),
    ...(manager ? [{ userId: manager, role: 'HIRING_MANAGER' as const }] : []),
    ...recruiters.map((userId) => ({ userId, role: 'RECRUITER' as const })),
    ...interviewers.map((userId) => ({
      userId,
      role: 'INTERVIEWER' as const,
    })),
    ...observers.map((userId) => ({ userId, role: 'OBSERVER' as const })),
  ];
  const memberIds = members.map((member) => member.userId);
  if (new Set(memberIds).size !== memberIds.length)
    return failure(
      'INVALID_INPUT',
      'Cada pessoa só pode ter uma função neste recrutamento.',
    );
  if (memberIds.length > MAX_HIRING_TEAM_SIZE)
    return failure(
      'INVALID_INPUT',
      `A equipa de uma vaga pode ter até ${MAX_HIRING_TEAM_SIZE} pessoas.`,
    );
  if (memberIds.some((userId) => !activeMemberIds.has(userId)))
    return failure(
      'INVALID_INPUT',
      'Só membros ativos da organização podem integrar a equipa da vaga.',
    );
  return success({
    leadRecruiterId: lead,
    hiringManagerId: manager,
    members,
    memberIds,
  });
}

/** R14: OWNER/ADMIN gerem qualquer equipa; o responsável atual gere a sua. */
export function canManageHiringTeam(
  actor: { userId: string; role: MemberRole },
  currentLeadRecruiterId: string | null,
): boolean {
  if (actor.role === 'OWNER' || actor.role === 'ADMIN') return true;
  return (
    actor.role === 'RECRUITER' &&
    Boolean(currentLeadRecruiterId) &&
    currentLeadRecruiterId === actor.userId
  );
}

/**
 * Lê uma equipa guardada, descartando quem já não é membro ativo (R58: sair
 * da organização tira a pessoa das equipas sem apagar o histórico).
 */
export function readHiringTeam(
  stored: Readonly<Record<string, unknown>> | undefined,
  activeMemberIds?: ReadonlySet<string>,
): HiringTeam {
  const raw = Array.isArray(stored?.members) ? stored.members : [];
  const members = raw
    .map((entry) => entry as Record<string, unknown>)
    .filter(
      (entry): entry is { userId: string; role: HiringTeamRole } =>
        typeof entry?.userId === 'string' &&
        (HIRING_TEAM_ROLES as readonly unknown[]).includes(entry.role),
    )
    .filter((entry) => !activeMemberIds || activeMemberIds.has(entry.userId))
    .map(({ userId, role }) => ({ userId, role }));
  const find = (role: HiringTeamRole) =>
    members.find((member) => member.role === role)?.userId ?? null;
  return {
    leadRecruiterId: find('LEAD_RECRUITER'),
    hiringManagerId: find('HIRING_MANAGER'),
    members,
    memberIds: members.map((member) => member.userId),
  };
}
