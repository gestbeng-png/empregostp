import { createHmac } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';

type Plain = Record<string, unknown>;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;
export const RECRUITMENT_NOTIFICATION_EVENTS = [
  'entity_status_changed',
  'interview_reminder',
  'employer_silence_reminder',
  'hire_confirmation_request',
  'application_assigned',
  'hiring_team_assigned',
] as const;

export interface RecruitmentNotice {
  userId: string | null;
  email: string | null;
  entityId: string;
  entityKind: string;
  type: string;
  title: string;
  body: string;
  path: string;
}

function atMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value)
    return (value as { toMillis(): number }).toMillis();
  return 0;
}

/** Resolve recipients from current records, never from caller-supplied event emails.
 * Private notes/feedback are deliberately excluded from every message. */
export async function resolveRecruitmentNotice(
  db: Firestore,
  event: OutboxEvent,
  now = Date.now(),
): Promise<RecruitmentNotice | null> {
  const read = async (
    collection: string,
    id: unknown,
  ): Promise<Plain | null> =>
    typeof id === 'string' && id && !id.includes('/')
      ? ((await db.collection(collection).doc(id).get()).data() ?? null)
      : null;
  const candidate = async (data: Plain) => {
    const app = data.applicationId
      ? await read('applications', data.applicationId)
      : data;
    const userId = data.candidateUserId ?? app?.candidateUserId ?? null;
    const user = userId ? await read('users', userId) : null;
    const snapshot =
      app?.candidateSnapshot && typeof app.candidateSnapshot === 'object'
        ? (app.candidateSnapshot as Plain)
        : null;
    return {
      userId: typeof userId === 'string' ? userId : null,
      email:
        text(snapshot?.email) ?? text(app?.candidateEmail) ?? text(user?.email),
    };
  };
  const payload = event.payload;
  if (
    event.type === 'entity_status_changed' &&
    payload.entityKind === 'TeamInvitation'
  ) {
    const data = await read('organizationInvitations', payload.entityId);
    if (!data || data.v2Status !== 'PENDING' || atMs(data.expiresAt) <= now)
      return null;
    if (!process.env.TEAM_INVITE_SECRET)
      throw new Error('TEAM_INVITE_CONFIGURATION_MISSING');
    const token = createHmac('sha256', process.env.TEAM_INVITE_SECRET)
      .update(`team-invite:${payload.entityId}`)
      .digest('base64url');
    return {
      userId: null,
      email: text(data.email),
      entityId: String(payload.entityId),
      entityKind: 'TeamInvitation',
      type: 'TEAM_INVITATION',
      title: 'Foi convidado para uma equipa — EmpregoSTP',
      body: 'Entre com a conta do email convidado para aceitar o convite. O convite expira em sete dias.',
      path: `/equipa/convite?i=${encodeURIComponent(String(payload.entityId))}&t=${token}`,
    };
  }
  // R94/R95: avisos de equipa — só in-app (sem email), só a quem recebe, e
  // só se a atribuição ainda for atual quando o outbox corre.
  if (event.type === 'application_assigned') {
    const assignment = await read(
      'applicationAssignments',
      payload.applicationId,
    );
    if (!assignment || assignment.userId !== payload.assigneeUserId)
      return null;
    const app = await read('applications', payload.applicationId);
    const jobTitle =
      text(app?.jobTitle) ??
      text((app?.jobSnapshot as Plain | undefined)?.titulo) ??
      'uma vaga';
    return {
      userId: String(payload.assigneeUserId),
      email: null,
      entityId: String(payload.applicationId),
      entityKind: 'Application',
      type: 'APPLICATION_ASSIGNED',
      title: 'Tem uma candidatura atribuída',
      body: `Ficou responsável pela análise de uma candidatura a ${jobTitle}.`,
      path: '/dashboard/recrutamento',
    };
  }
  if (event.type === 'hiring_team_assigned') {
    const process = await read('hiringProcesses', payload.jobId);
    const memberIds = Array.isArray(process?.memberIds)
      ? process.memberIds
      : [];
    if (!memberIds.includes(payload.userId)) return null;
    const job = await read('jobs', payload.jobId);
    const jobTitle = text(job?.titulo) ?? text(job?.title) ?? 'uma vaga';
    return {
      userId: String(payload.userId),
      email: null,
      entityId: String(payload.jobId),
      entityKind: 'Job',
      type: 'JOB_ASSIGNED',
      title: 'Foi adicionado à equipa de uma vaga',
      body: `Passou a integrar a equipa de recrutamento de ${jobTitle}.`,
      path: '/dashboard/recrutamento',
    };
  }
  if (event.type === 'employer_silence_reminder') {
    if (!['REMINDER_D5', 'REMINDER_D10'].includes(String(payload.stage)))
      return null;
    const job = await read('jobs', payload.jobId);
    if (
      !job ||
      ['CLOSED', 'FILLED', 'EXPIRED', 'CANCELLED'].includes(
        String(job.v2Status),
      )
    )
      return null;
    const orgId = job.organizationId ?? job.companyId;
    const organization = await read('organizations', orgId);
    const userId = text(organization?.ownerUserId) ?? text(orgId);
    const user = await read('users', userId);
    if (!userId || !user) return null;
    return {
      userId,
      email: text(user.email),
      entityId: String(payload.jobId),
      entityKind: 'Job',
      type: 'EMPLOYER_SILENCE_REMINDER',
      title: 'Tem candidaturas por analisar',
      body: 'Abra o painel de recrutamento para analisar e responder às candidaturas recebidas.',
      path: '/dashboard/recrutamento',
    };
  }
  if (event.type === 'hire_confirmation_request') {
    if (payload.stage !== 'REQUEST') return null;
    const hire = await read('hires', payload.hireId);
    if (
      !hire ||
      hire.v2Status !== 'ACTIVE' ||
      hire.candidateConfirmation !== 'PENDING'
    )
      return null;
    return {
      ...(await candidate(hire)),
      entityId: String(payload.hireId),
      entityKind: 'Hire',
      type: 'HIRE_CONFIRMATION_REQUEST',
      title: 'Confirme o início da sua atividade',
      body: 'Já começou a trabalhar? Confirme ou conteste o início no acompanhamento da sua candidatura.',
      path: '/dashboard/candidato/candidaturas',
    };
  }
  const collections: Record<string, string> = {
    Application: 'applications',
    Offer: 'offers',
    Hire: 'hires',
    Interview: 'interviews',
  };
  const kind =
    event.type === 'interview_reminder'
      ? 'Interview'
      : String(payload.entityKind);
  const id = String(
    event.type === 'interview_reminder'
      ? payload.interviewId
      : payload.entityId,
  );
  const collection = collections[kind];
  if (!collection) return null;
  const data = await read(collection, id);
  if (!data) return null;
  if (
    event.type === 'interview_reminder' &&
    (!['SCHEDULED', 'CONFIRMED'].includes(String(data.v2Status)) ||
      atMs(data.startsAt) <= now)
  )
    return null;
  const title =
    event.type === 'interview_reminder'
      ? 'Lembrete da sua entrevista'
      : kind === 'Interview'
        ? 'A sua entrevista foi atualizada'
        : kind === 'Hire'
          ? 'O seu processo de contratação foi atualizado'
          : kind === 'Offer'
            ? 'A sua proposta foi atualizada'
            : 'A sua candidatura foi atualizada';
  return {
    ...(await candidate(data)),
    entityId: id,
    entityKind: kind,
    type:
      event.type === 'interview_reminder'
        ? 'INTERVIEW_REMINDER'
        : `${kind.toUpperCase()}_STATUS_CHANGED`,
    title,
    body: 'Consulte o acompanhamento para ver os detalhes mais recentes e, no caso de entrevista, descarregar o calendário.',
    path: '/dashboard/candidato/candidaturas',
  };
}
