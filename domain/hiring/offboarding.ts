/**
 * R57/R58 — saída de um membro sem deixar processos órfãos. Puro.
 *
 * Antes de remover alguém, mostra-se o que tem a cargo. Responsabilidades
 * operacionais (vagas que lidera, candidaturas atribuídas, entrevistas
 * futuras) TÊM de passar para outra pessoa; funções de apoio (Hiring
 * Manager, recrutador, entrevistador, observador numa equipa) simplesmente
 * terminam. A autoria histórica (notas, decisões) nunca muda.
 */
import type { MemberRole } from '../memberships/teamRules';
import { failure, success } from '../shared/Result';
import type { Result } from '../shared/Result';

import { HIRING_TEAM_ROLES } from './team';
import type { HiringTeamMember } from './team';

const LIVE_INTERVIEW = new Set([
  'SCHEDULED',
  'CONFIRMED',
  'RESCHEDULE_REQUESTED',
]);
const OPEN_APPLICATION = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
]);

export interface MemberResponsibilities {
  /** Vagas em que é responsável (Lead Recruiter). */
  leadJobIds: string[];
  /** Vagas em que tem outra função de equipa (termina com a saída). */
  supportJobIds: string[];
  /** Candidaturas em curso de que é responsável pela análise. */
  assignedApplicationIds: string[];
  /** Entrevistas por realizar em que é entrevistador. */
  upcomingInterviewIds: string[];
}

export function summarizeResponsibilities(
  memberId: string,
  input: {
    processes: readonly {
      jobId: string;
      members: readonly HiringTeamMember[];
    }[];
    assignments: readonly {
      applicationId: string;
      userId: string | null;
      applicationStatus: string;
    }[];
    interviews: readonly {
      id: string;
      status: string;
      startsAt: number | null;
      interviewerUserIds: readonly string[];
    }[];
    now: number;
  },
): MemberResponsibilities {
  const leadJobIds: string[] = [];
  const supportJobIds: string[] = [];
  for (const process of input.processes) {
    const entry = process.members.find((member) => member.userId === memberId);
    if (!entry) continue;
    (entry.role === 'LEAD_RECRUITER' ? leadJobIds : supportJobIds).push(
      process.jobId,
    );
  }
  return {
    leadJobIds,
    supportJobIds,
    assignedApplicationIds: input.assignments
      .filter(
        (row) =>
          row.userId === memberId &&
          OPEN_APPLICATION.has(row.applicationStatus),
      )
      .map((row) => row.applicationId),
    upcomingInterviewIds: input.interviews
      .filter(
        (row) =>
          row.interviewerUserIds.includes(memberId) &&
          LIVE_INTERVIEW.has(row.status) &&
          row.startsAt !== null &&
          row.startsAt > input.now,
      )
      .map((row) => row.id),
  };
}

export const needsTransfer = (r: MemberResponsibilities): boolean =>
  r.leadJobIds.length > 0 ||
  r.assignedApplicationIds.length > 0 ||
  r.upcomingInterviewIds.length > 0;

/**
 * Quem recebe tem de ser outro membro ativo que possa conduzir processos
 * (OWNER, ADMIN ou RECRUITER — um avaliador não muda estados).
 */
export function validateTransferTarget(
  memberId: string,
  responsibilities: MemberResponsibilities,
  target: { userId: string | null; role: MemberRole | null },
): Result<string | null> {
  if (!needsTransfer(responsibilities)) return success(target.userId ?? null);
  if (!target.userId)
    return failure(
      'INVALID_INPUT',
      'Escolha quem fica com as responsabilidades desta pessoa antes de a remover.',
    );
  if (target.userId === memberId) return failure('INVALID_INPUT');
  if (!target.role || !['OWNER', 'ADMIN', 'RECRUITER'].includes(target.role))
    return failure(
      'INVALID_INPUT',
      'As responsabilidades só podem passar para o proprietário, um administrador ou um recrutador ativo.',
    );
  return success(target.userId);
}

/**
 * Nova equipa de uma vaga depois da saída: se o membro liderava, quem recebe
 * passa a responsável (deixando a função que tinha); as outras funções do
 * membro terminam. Com `ensureAccess`, quem recebe entra como recrutador
 * para manter acesso às candidaturas que herda.
 */
export function reassignTeam(
  members: readonly HiringTeamMember[],
  memberId: string,
  targetId: string | null,
  ensureAccess: boolean,
): HiringTeamMember[] {
  const wasLead = members.some(
    (member) => member.userId === memberId && member.role === 'LEAD_RECRUITER',
  );
  let next = members.filter((member) => member.userId !== memberId);
  if (!targetId) return next;
  if (wasLead) {
    next = next.filter((member) => member.userId !== targetId);
    next = [{ userId: targetId, role: 'LEAD_RECRUITER' }, ...next];
  } else if (ensureAccess && !next.some((member) => member.userId === targetId))
    next = [...next, { userId: targetId, role: 'RECRUITER' }];
  return next.filter((member) =>
    (HIRING_TEAM_ROLES as readonly string[]).includes(member.role),
  );
}

/** Entrevistadores depois da saída: quem recebe substitui o membro, sem duplicar. */
export function reassignInterviewers(
  interviewerUserIds: readonly string[],
  memberId: string,
  targetId: string,
): string[] {
  return [
    ...new Set(
      interviewerUserIds.map((id) => (id === memberId ? targetId : id)),
    ),
  ];
}
