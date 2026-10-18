import {
  alreadyAppliedFailure,
  checkApplicationEligibility,
} from '@/domain/applications/eligibility';
import type { EligibilityFailure } from '@/domain/applications/eligibility';
import {
  buildAnswersSnapshot,
  buildCandidateSnapshot,
  buildJobSnapshot,
  deepFreeze,
  selectSharedContacts,
} from '@/domain/applications/snapshot';
import { mapLegacyLocation } from '@/domain/geo/districts';
import { readJobLifecycle } from '@/domain/jobs/legacyView';
import {
  evaluateKnockout,
  validateScreeningQuestions,
} from '@/domain/jobs/screening';
import { can } from '@/domain/permissions/can';
import { permissionRoleOf } from '@/domain/permissions/legacyRole';

/**
 * F2 — submissão de candidatura.
 *
 * Gratuita (F2.1/G2.1): nenhum passo consulta plano ou pagamento. O limite é
 * só anti-spam (D13). A decisão final (vaga aberta, prazo, unicidade,
 * idempotência) repete-se dentro da transação do store: a pré-validação aqui
 * só serve para devolver todas as mensagens de uma vez.
 */
type Plain = Readonly<Record<string, unknown>>;

export const APPLICATION_SOURCES = [
  'organic',
  'search',
  'social',
  'whatsapp',
  'email',
  'direct',
  'partner',
  'invite',
  'alert',
] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export interface SubmitApplicationCommand {
  candidateUserId: string;
  jobId: string;
  idempotencyKey: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  answers: unknown;
  coverLetter: string;
  sharedContacts: readonly string[] | null;
  /** Requisitos em falta, avisados mas não bloqueantes (F2.3/F3.4). */
  hardRequirementsNotMet?: readonly string[];
  source: string | null;
  utm: unknown;
  /** Campos que os painéis atuais leem (D7, dual-write). Sem plano/prioridade. */
  legacyFields: Plain;
}

export interface CandidateRecord {
  user: Plain;
  profile: Plain;
}
export interface JobRecord {
  id: string;
  data: Plain;
}

export interface PersistApplicationInput {
  applicationId: string;
  candidateUserId: string;
  jobId: string;
  organizationId: string | null;
  idempotencyKey: string;
  document: Plain;
}
export type PersistOutcome =
  | { kind: 'CREATED' | 'REPLAYED'; applicationId: string }
  | { kind: 'ALREADY_APPLIED'; submittedAt: Date }
  | { kind: 'JOB_NOT_ACCEPTING' }
  | { kind: 'IDEMPOTENCY_CONFLICT' };

export interface ApplicationSubmissionStore {
  loadCandidate(userId: string): Promise<CandidateRecord | null>;
  loadJob(jobId: string): Promise<JobRecord | null>;
  findExisting(applicationId: string): Promise<{ submittedAt: Date } | null>;
  /** Transação única: relê a vaga, verifica prazo/unicidade/chave e grava
   * candidatura + histórico + outbox + chave de idempotência. */
  persist(input: PersistApplicationInput, now: Date): Promise<PersistOutcome>;
}
export interface CvSnapshotter {
  /** Copia o CV para um caminho privado e imutável, único por tentativa
   * (`attempt`): uma tentativa recusada nunca sobrescreve a cópia de uma
   * candidatura já gravada. Devolve o caminho ou `null` se falhar. */
  copy(
    sourcePath: string,
    applicationId: string,
    attempt: string,
  ): Promise<string | null>;
}
export type ApplicationRateLimiter = (userId: string) => Promise<boolean>;

export type SubmitApplicationResult =
  | { ok: true; applicationId: string; replayed: boolean }
  | {
      ok: false;
      code:
        | 'FEATURE_DISABLED'
        | 'NOT_FOUND'
        | 'NOT_CANDIDATE'
        | 'IDEMPOTENCY_CONFLICT'
        | 'CV_SNAPSHOT_FAILED'
        | 'ELIGIBILITY';
      failures: EligibilityFailure[];
    };

const IDEMPOTENCY_KEY = /^[a-zA-Z0-9_-]{16,128}$/;

export function applicationIdFor(jobId: string, userId: string): string {
  // Chave determinística (D2/D8): a unicidade é garantida pelo documento.
  return `${jobId}_${userId}`;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSource(source: string | null): ApplicationSource {
  return (APPLICATION_SOURCES as readonly string[]).includes(source ?? '')
    ? (source as ApplicationSource)
    : 'direct';
}

function normalizeUtm(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const utm: Record<string, string> = {};
  for (const key of [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'ref',
  ]) {
    const item = (value as Plain)[key];
    if (typeof item === 'string' && item.trim())
      utm[key] = item.trim().slice(0, 120);
  }
  return utm;
}

export class SubmitApplication {
  constructor(
    private readonly store: ApplicationSubmissionStore,
    private readonly cv: CvSnapshotter,
    private readonly rateLimit: ApplicationRateLimiter,
    private readonly resolveCvPath: (
      userId: string,
      value: unknown,
    ) => string | null,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    command: SubmitApplicationCommand,
  ): Promise<SubmitApplicationResult> {
    const fail = (
      code: Exclude<SubmitApplicationResult, { ok: true }>['code'],
      failures: EligibilityFailure[] = [],
    ): SubmitApplicationResult => ({ ok: false, code, failures });

    const [candidate, job] = await Promise.all([
      this.store.loadCandidate(command.candidateUserId),
      this.store.loadJob(command.jobId),
    ]);
    if (!job) return fail('NOT_FOUND');
    // D14/H3: só o papel CANDIDATE se candidata (resolvido da conta no servidor).
    if (
      !candidate ||
      !can(
        {
          userId: command.candidateUserId,
          role: permissionRoleOf(candidate.user),
          active: true,
        },
        'apply',
        { candidateUserId: command.candidateUserId },
      )
    )
      return fail('NOT_CANDIDATE');

    const now = this.clock();
    const { user, profile } = candidate;
    const applicationId = applicationIdFor(
      command.jobId,
      command.candidateUserId,
    );
    const lifecycle = readJobLifecycle(job.data);
    const location = String(
      profile.district ??
        profile.city ??
        profile.location ??
        user.location ??
        user.localizacao ??
        '',
    );
    const mapped = mapLegacyLocation(location);
    const cvValue = profile.cvUrl ?? user.cvUrl;
    const cvSourcePath = this.resolveCvPath(command.candidateUserId, cvValue);
    const questions = list(job.data.screeningQuestions).filter(
      (item): item is Plain => Boolean(item) && typeof item === 'object',
    );
    const answers = buildAnswersSnapshot(command.answers);
    const screening = validateScreeningQuestions(
      job.data.screeningQuestions,
      8,
    );
    const knockoutFailedIds = screening.ok
      ? evaluateKnockout(screening.questions, answers)
      : [];
    const key =
      command.idempotencyKey && IDEMPOTENCY_KEY.test(command.idempotencyKey)
        ? command.idempotencyKey
        : null;

    const previous = await this.store.findExisting(applicationId);
    const failures = checkApplicationEligibility({
      now,
      candidate: {
        authenticated: true,
        emailVerified: command.emailVerified,
        phoneVerified: command.phoneVerified,
        // A rota já recusa contas bloqueadas; repete-se para o domínio ser completo.
        suspended: ['suspended', 'disabled', 'inactive'].includes(
          String(user.status ?? '').toLowerCase(),
        ),
        name: String(user.fullName ?? user.name ?? profile.fullName ?? ''),
        hasDistrictOrAbroad: Boolean(location.trim()),
        hasCv: Boolean(cvSourcePath),
        experienceOrEducationCount:
          list(profile.experience).length +
          list(user.experience).length +
          (Array.isArray(profile.education)
            ? profile.education.length
            : typeof profile.education === 'string' &&
                profile.education.trim().length >= 10
              ? 1
              : 0),
      },
      job: lifecycle,
      // Uma retoma com a mesma chave não é uma segunda candidatura.
      previousApplication: key ? null : previous,
      requiredQuestionIds: questions
        .filter((item) => item.required === true && typeof item.id === 'string')
        .map((item) => item.id as string),
      answeredQuestionIds: answers
        .filter((item) =>
          Array.isArray(item.value) ? item.value.length > 0 : item.value !== '',
        )
        .map((item) => item.questionId),
      // Só se consome o limite quando o resto passou (evita gastar tentativas).
      rateLimitAllowed: true,
      idempotencyKey: key,
    });
    if (failures.length) return fail('ELIGIBILITY', failures);
    if (!previous && !(await this.rateLimit(command.candidateUserId)))
      return fail('ELIGIBILITY', [
        {
          code: 'RATE_LIMITED',
          message:
            'Fez muitas candidaturas em pouco tempo. Tente novamente dentro de alguns minutos.',
        },
      ]);

    // F2.4: cópia imutável do ficheiro. Sem ela não há snapshot íntegro, por
    // isso a candidatura não é gravada (o candidato pode repetir; a chave de
    // idempotência mantém-se). Numa retoma a cópia já existe.
    let cvSnapshotKey: string | null = null;
    if (cvSourcePath && !previous) {
      cvSnapshotKey = await this.cv.copy(
        cvSourcePath,
        applicationId,
        key as string,
      );
      if (!cvSnapshotKey) return fail('CV_SNAPSHOT_FAILED');
    }

    const contacts = selectSharedContacts(
      {
        email: typeof user.email === 'string' ? user.email : undefined,
        emailVerified: command.emailVerified,
        phone:
          typeof user.phone === 'string'
            ? user.phone
            : typeof profile.phone === 'string'
              ? profile.phone
              : undefined,
        phoneVerified: command.phoneVerified,
      },
      command.sharedContacts,
    );
    const candidateSnapshot = buildCandidateSnapshot({
      user,
      profile,
      district: mapped.district,
      contacts,
    });
    const jobVersionId =
      typeof job.data.currentVersionId === 'string'
        ? job.data.currentVersionId
        : null;
    const document = deepFreeze({
      ...command.legacyFields,
      jobId: command.jobId,
      jobVersionId,
      candidateId: command.candidateUserId,
      candidateUserId: command.candidateUserId,
      organizationId: lifecycle.organizationId,
      v2Status: 'SUBMITTED',
      version: 1,
      closedReason: null,
      candidateSnapshot,
      cvSnapshotKey,
      jobSnapshot: buildJobSnapshot(command.jobId, job.data, jobVersionId),
      answersSnapshot: answers,
      coverLetter: command.coverLetter,
      // F3.4: resposta contrária a um eliminatório só marca; nunca rejeita.
      knockoutFailed: knockoutFailedIds.length > 0,
      hardRequirementsNotMet: [
        ...new Set([
          ...(command.hardRequirementsNotMet ?? []).filter(
            (item) =>
              typeof item === 'string' &&
              /^[A-Z_]+:[a-z0-9_-]{1,40}$/i.test(item),
          ),
          ...knockoutFailedIds.map((id) => `KNOCKOUT:${id}`),
        ]),
      ].slice(0, 20),
      source: normalizeSource(command.source),
      utm: normalizeUtm(command.utm),
      firstViewedAt: null,
      snapshotSchemaVersion: candidateSnapshot.schemaVersion,
    });
    // `key` é não-nulo: sem chave a elegibilidade já falhou.
    const outcome = await this.store.persist(
      {
        applicationId,
        candidateUserId: command.candidateUserId,
        jobId: command.jobId,
        organizationId: lifecycle.organizationId,
        idempotencyKey: key as string,
        document,
      },
      now,
    );
    switch (outcome.kind) {
      case 'CREATED':
      case 'REPLAYED':
        return {
          ok: true,
          applicationId: outcome.applicationId,
          replayed: outcome.kind === 'REPLAYED',
        };
      case 'IDEMPOTENCY_CONFLICT':
        return fail('IDEMPOTENCY_CONFLICT');
      case 'ALREADY_APPLIED':
        return fail('ELIGIBILITY', [
          alreadyAppliedFailure(outcome.submittedAt),
        ]);
      case 'JOB_NOT_ACCEPTING':
        return fail('ELIGIBILITY', [
          {
            code: 'JOB_NOT_ACCEPTING',
            message: 'Esta vaga já não aceita candidaturas.',
          },
        ]);
    }
  }
}
