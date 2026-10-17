import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type {
  FeatureFlagReader,
  ResolvedIdentity,
} from '@/application/marketplace/ports';
import {
  buildEmployerApplicationView,
  isValidRating,
  normalizeTags,
  parseInternalNote,
} from '@/domain/applications/employerWorkspace';
import type { EmployerApplicationView } from '@/domain/applications/employerWorkspace';
import type { FeatureContext } from '@/domain/feature-flags/flags';
import { can } from '@/domain/permissions/can';
import type { PermissionAction } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { Result } from '@/domain/shared/Result';

import {
  FirestoreLifecycleStore,
  resolveIdentity,
} from '../marketplace/FirestoreLifecycleStore';
import { validDocumentId } from '../marketplace/identifiers';

type Plain = Record<string, unknown>;
const SIGNED_URL_TTL_MS = 5 * 60_000;

export interface SignedUrlFactory {
  (objectPath: string, expiresAtMs: number): Promise<string | null>;
}

/**
 * F3.1/F3.5/H4 — o que a organização faz numa candidatura v2 fora das
 * transições: ver (1.ª leitura → UNDER_REVIEW pelo sistema), notas internas,
 * avaliação, etiquetas e descarga auditada do CV do snapshot. Cada operação
 * resolve a identidade no servidor e chama `can()` com a organização da
 * candidatura — nunca a partir de um parâmetro do cliente (D6/D14).
 */
export class FirestoreApplicationWorkspace {
  constructor(
    private readonly db: Firestore,
    private readonly flags: FeatureFlagReader,
    private readonly context: FeatureContext,
    private readonly now: () => number = Date.now,
  ) {}

  private async load(
    userId: string,
    applicationId: string,
    action: PermissionAction,
  ): Promise<
    Result<{ app: Plain; identity: ResolvedIdentity; organizationId: string }>
  > {
    if (!validDocumentId(applicationId) || !validDocumentId(userId))
      return failure('NOT_FOUND');
    const app = (
      await this.db.collection('applications').doc(applicationId).get()
    ).data();
    if (
      !app ||
      typeof app.v2Status !== 'string' ||
      typeof app.organizationId !== 'string'
    )
      return failure('NOT_FOUND');
    const organizationId = app.organizationId;
    if (
      !(await this.flags.enabled('V2_EMPLOYER_ATS', {
        ...this.context,
        organizationId,
        userId,
      }))
    )
      return failure('FEATURE_DISABLED');
    const identity = await resolveIdentity(
      this.db,
      { get: (ref: { get: () => unknown }) => ref.get() } as never,
      userId,
      organizationId,
    );
    if (
      !identity ||
      !can(identity.permission, action, {
        organizationId,
        jobId: typeof app.jobId === 'string' ? app.jobId : undefined,
      })
    )
      return failure('FORBIDDEN');
    return success({ app, identity, organizationId });
  }

  async view(
    userId: string,
    applicationId: string,
  ): Promise<Result<EmployerApplicationView>> {
    const loaded = await this.load(userId, applicationId, 'view_application');
    if (!loaded.ok) return loaded;
    let { app } = loaded.value;
    const { organizationId } = loaded.value;
    // E4: a 1.ª abertura por alguém da organização passa a «Em análise»
    // (ator SYSTEM, `firstViewedAt`). Idempotente pela chave fixa.
    if (app.v2Status === 'SUBMITTED') {
      const moved = await new FirestoreLifecycleStore(
        this.db,
        this.now,
      ).transitionAsSystem(
        {
          kind: 'Application',
          entityId: applicationId,
          to: 'UNDER_REVIEW',
          expectedVersion: Number(app.version) || 0,
          systemJob: 'firstView',
          idempotencyKey: `first_view_${applicationId}`
            .slice(0, 128)
            .padEnd(16, '0'),
        },
        async (record) =>
          record.v2Status === 'SUBMITTED'
            ? success({})
            : failure('VERSION_CONFLICT'),
      );
      if (moved.ok)
        app =
          (
            await this.db.collection('applications').doc(applicationId).get()
          ).data() ?? app;
    }
    const candidateUserId = String(app.candidateUserId ?? '');
    const [history, internals, notes, previous] = await Promise.all([
      this.db
        .collection('applicationsStatusHistory')
        .where('entityId', '==', applicationId)
        .get(),
      this.db.collection('applicationInternals').doc(applicationId).get(),
      this.db
        .collection('applicationNotes')
        .where('applicationId', '==', applicationId)
        .get(),
      candidateUserId
        ? this.db
            .collection('applications')
            .where('candidateUserId', '==', candidateUserId)
            .where('organizationId', '==', organizationId)
            .limit(20)
            .get()
        : Promise.resolve(null),
    ]);
    return success(
      buildEmployerApplicationView({
        applicationId,
        application: app,
        history: history.docs.map((doc) => doc.data()),
        internals: internals.data() ?? null,
        notes: notes.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        previousApplications: (previous?.docs ?? [])
          .filter((doc) => doc.id !== applicationId)
          .map((doc) => doc.data()),
      }),
    );
  }

  async addNote(
    userId: string,
    applicationId: string,
    body: unknown,
  ): Promise<Result<{ noteId: string }>> {
    const loaded = await this.load(userId, applicationId, 'internal_notes');
    if (!loaded.ok) return loaded;
    const { organizationId } = loaded.value;
    const members = await this.db
      .collection('organizationMemberships')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'ACTIVE')
      .get();
    const parsed = parseInternalNote(body, [
      organizationId,
      ...members.docs.map((doc) => String(doc.data().userId ?? '')),
    ]);
    if (!parsed.ok) return failure('INVALID_INPUT');
    const ref = this.db.collection('applicationNotes').doc();
    await ref.create({
      applicationId,
      organizationId,
      authorId: userId,
      body: parsed.body,
      mentions: parsed.mentions,
      visibility: 'INTERNAL',
      createdAt: Timestamp.fromMillis(this.now()),
    });
    return success({ noteId: ref.id });
  }

  async review(
    userId: string,
    applicationId: string,
    input: { rating?: unknown; tags?: unknown },
  ): Promise<Result<{ updated: true }>> {
    const loaded = await this.load(userId, applicationId, 'internal_notes');
    if (!loaded.ok) return loaded;
    const update: Plain = {};
    if (input.rating !== undefined) {
      if (!isValidRating(input.rating)) return failure('INVALID_INPUT');
      update[`ratings.${userId}`] = input.rating;
    }
    if (input.tags !== undefined) {
      const tags = normalizeTags(input.tags);
      if (!tags) return failure('INVALID_INPUT');
      update.tags = tags;
    }
    if (!Object.keys(update).length) return failure('INVALID_INPUT');
    const ref = this.db.collection('applicationInternals').doc(applicationId);
    await this.db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists)
        tx.set(ref, {
          applicationId,
          organizationId: loaded.value.organizationId,
          ratings: {},
          tags: [],
        });
      tx.update(ref, {
        ...update,
        updatedAt: Timestamp.fromMillis(this.now()),
        updatedBy: userId,
      });
    });
    return success({ updated: true });
  }

  /** D14/H4: URL assinada de 5 min, só depois de can(), e AuditLog por acesso. */
  async cvUrl(
    userId: string,
    applicationId: string,
    sign: SignedUrlFactory,
  ): Promise<Result<{ url: string; expiresAt: string }>> {
    const loaded = await this.load(
      userId,
      applicationId,
      'download_application_cv',
    );
    if (!loaded.ok) return loaded;
    const key = loaded.value.app.cvSnapshotKey;
    if (
      typeof key !== 'string' ||
      !key.startsWith(`applicationSnapshots/${applicationId}/`)
    )
      return failure('NOT_FOUND');
    const expiresAtMs = this.now() + SIGNED_URL_TTL_MS;
    const url = await sign(key, expiresAtMs);
    if (!url) return failure('NOT_FOUND');
    await this.db
      .collection('auditLogs')
      .doc()
      .create({
        actorId: userId,
        actorType: loaded.value.identity.transition,
        action: 'application_cv_downloaded',
        resourceType: 'Application',
        resourceId: applicationId,
        organizationId: loaded.value.organizationId,
        metadata: { ttlSeconds: SIGNED_URL_TTL_MS / 1000 },
        at: Timestamp.fromMillis(this.now()),
      });
    return success({ url, expiresAt: new Date(expiresAtMs).toISOString() });
  }
}
