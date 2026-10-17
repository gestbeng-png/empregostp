import { extname } from 'node:path';

import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type {
  ApplicationSubmissionStore,
  CandidateRecord,
  CvSnapshotter,
  JobRecord,
  PersistApplicationInput,
  PersistOutcome,
} from '@/application/applications/SubmitApplication';
import { isAcceptingApplications } from '@/domain/jobs/deadlines';
import { readJobLifecycle } from '@/domain/jobs/legacyView';

import { digest, validDocumentId } from '../marketplace/identifiers';

const IDEMPOTENCY_TTL_MS = 86_400_000;
const SCOPE = 'application_submit';

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** O Firestore recusa `undefined` (sem `ignoreUndefinedProperties`). */
export function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value))
    return value.filter((item) => item !== undefined).map(withoutUndefined);
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)]),
    );
  return value;
}

function submittedAtOf(data: Readonly<Record<string, unknown>>): Date {
  return (
    toDate(data.submittedAt) ??
    toDate(data.appliedAt) ??
    toDate(data.createdAt) ??
    new Date(0)
  );
}

/**
 * D4/D8/F2.4 — uma transação: relê a vaga (prazo no servidor, mesmo que o cron
 * ainda não tenha corrido), confirma a unicidade pelo id determinístico e a
 * chave de idempotência, e grava candidatura + histórico + outbox + chave.
 * Nada aqui envia email ou notificações: isso sai pela outbox (D5).
 */
export class FirestoreApplicationSubmissionStore implements ApplicationSubmissionStore {
  constructor(private readonly db: Firestore) {}

  async loadCandidate(userId: string): Promise<CandidateRecord | null> {
    if (!validDocumentId(userId)) return null;
    const [user, profile] = await Promise.all([
      this.db.collection('users').doc(userId).get(),
      this.db.collection('profiles').doc(userId).get(),
    ]);
    if (!user.exists) return null;
    return { user: user.data() ?? {}, profile: profile.data() ?? {} };
  }

  async loadJob(jobId: string): Promise<JobRecord | null> {
    if (!validDocumentId(jobId)) return null;
    const job = await this.db.collection('jobs').doc(jobId).get();
    return job.exists ? { id: job.id, data: job.data() ?? {} } : null;
  }

  async findExisting(
    applicationId: string,
  ): Promise<{ submittedAt: Date } | null> {
    if (!validDocumentId(applicationId)) return null;
    const doc = await this.db
      .collection('applications')
      .doc(applicationId)
      .get();
    const data = doc.data();
    return data ? { submittedAt: submittedAtOf(data) } : null;
  }

  async persist(
    input: PersistApplicationInput,
    now: Date,
  ): Promise<PersistOutcome> {
    const appRef = this.db.collection('applications').doc(input.applicationId);
    const jobRef = this.db.collection('jobs').doc(input.jobId);
    const keyHash = digest([
      input.candidateUserId,
      SCOPE,
      input.idempotencyKey,
    ]);
    const requestHash = digest([SCOPE, input.jobId]);
    const keyRef = this.db.collection('idempotencyKeys').doc(keyHash);
    // Alocados uma vez, não em cada nova tentativa da transação.
    const historyRef = this.db.collection('applicationsStatusHistory').doc();
    const eventRef = this.db.collection('outboxEvents').doc();
    const at = Timestamp.fromDate(now);

    return this.db.runTransaction(async (tx): Promise<PersistOutcome> => {
      const [prior, application, job] = await Promise.all([
        tx.get(keyRef),
        tx.get(appRef),
        tx.get(jobRef),
      ]);
      const saved = prior.data();
      if (
        saved &&
        typeof saved.expiresAtMs === 'number' &&
        saved.expiresAtMs > now.getTime()
      ) {
        if (
          saved.requestHash !== requestHash ||
          saved.response?.applicationId !== input.applicationId
        )
          return { kind: 'IDEMPOTENCY_CONFLICT' };
        return { kind: 'REPLAYED', applicationId: input.applicationId };
      }
      const existing = application.data();
      if (existing)
        return {
          kind: 'ALREADY_APPLIED',
          submittedAt: submittedAtOf(existing),
        };
      const jobData = job.data();
      if (!jobData || !isAcceptingApplications(readJobLifecycle(jobData), now))
        return { kind: 'JOB_NOT_ACCEPTING' };

      tx.create(appRef, {
        ...(withoutUndefined(input.document) as Record<string, unknown>),
        // Estado legado (D7): os painéis atuais leem `status`.
        status: 'pending',
        submittedAt: at,
        appliedAt: at,
        lastStatusChangeAt: at,
        createdAt: at,
        updatedAt: at,
        updatedBy: input.candidateUserId,
      });
      tx.create(historyRef, {
        entityId: input.applicationId,
        from: null,
        to: 'SUBMITTED',
        actorId: input.candidateUserId,
        actorType: 'CANDIDATE',
        reason: null,
        at,
        version: 1,
      });
      tx.create(eventRef, {
        type: 'entity_status_changed',
        schemaVersion: 1,
        payload: {
          entityId: input.applicationId,
          entityKind: 'Application',
          version: 1,
        },
        status: 'PENDING',
        attempts: 0,
        createdAtMs: now.getTime(),
        nextAttemptAtMs: now.getTime(),
      });
      tx.set(keyRef, {
        keyHash,
        scope: SCOPE,
        actorId: input.candidateUserId,
        requestHash,
        response: { applicationId: input.applicationId },
        createdAt: at,
        expiresAtMs: now.getTime() + IDEMPOTENCY_TTL_MS,
        expiresAt: Timestamp.fromMillis(now.getTime() + IDEMPOTENCY_TTL_MS),
      });
      return { kind: 'CREATED', applicationId: input.applicationId };
    });
  }
}

export interface StorageFileLike {
  bucket: { file(path: string): unknown };
  copy(destination: unknown): Promise<unknown>;
}

const CV_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

/** F2.4 — cópia privada: `applicationSnapshots/` não tem regra de leitura no
 * Storage; o acesso passa sempre por uma rota que chama `can()` e assina. */
export class StorageCvSnapshotter implements CvSnapshotter {
  constructor(
    private readonly locate: (path: string) => Promise<StorageFileLike | null>,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  async copy(
    sourcePath: string,
    applicationId: string,
    attempt: string,
  ): Promise<string | null> {
    const ext = extname(sourcePath).toLowerCase();
    const destination = `applicationSnapshots/${applicationId}/${digest([
      attempt,
    ]).slice(0, 24)}/cv${CV_EXTENSIONS.has(ext) ? ext : ''}`;
    try {
      const source = await this.locate(sourcePath);
      if (!source) return null;
      await source.copy(source.bucket.file(destination));
      return destination;
    } catch (error) {
      this.onError(error);
      return null;
    }
  }
}
