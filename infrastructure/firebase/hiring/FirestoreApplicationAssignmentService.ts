import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type { FeatureFlagReader } from '@/application/marketplace/ports';
import type { FeatureContext } from '@/domain/feature-flags/flags';
import {
  isAssignable,
  parseAssignmentRequest,
} from '@/domain/hiring/assignment';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { resolveIdentity } from '../marketplace/FirestoreLifecycleStore';

class Abort extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}
const plainTx = { get: (ref: { get(): unknown }) => ref.get() } as never;

/**
 * R24/R25/R88 — responsável pela análise de cada candidatura, guardado em
 * `applicationAssignments/{applicationId}` (interno; o candidato lê o
 * documento da candidatura, por isso a atribuição nunca vive lá).
 */
export class FirestoreApplicationAssignmentService {
  constructor(
    private readonly db: Firestore,
    private readonly flags: FeatureFlagReader,
    private readonly context: FeatureContext,
    private readonly now: () => number = Date.now,
  ) {}

  async assign(
    userId: string,
    input: {
      organizationId?: unknown;
      applicationIds?: unknown;
      assigneeUserId?: unknown;
    },
  ): Promise<Result<{ updated: number; assigneeUserId: string | null }>> {
    const parsed = parseAssignmentRequest(input);
    if (!parsed.ok) return parsed;
    const { organizationId, applicationIds, assigneeUserId } = parsed.value;
    if (
      !(await this.flags.enabled('V2_EMPLOYER_ATS', {
        ...this.context,
        organizationId,
        userId,
      }))
    )
      return failure('FEATURE_DISABLED');
    const actor = await resolveIdentity(
      this.db,
      plainTx,
      userId,
      organizationId,
    );
    if (!actor?.permission.membershipActive) return failure('FORBIDDEN');
    const assignee = assigneeUserId
      ? await resolveIdentity(this.db, plainTx, assigneeUserId, organizationId)
      : null;
    if (assigneeUserId && !assignee?.permission.membershipActive)
      return failure(
        'INVALID_INPUT',
        'Só membros ativos da organização podem ser responsáveis.',
      );

    try {
      const updated = await this.db.runTransaction(async (tx) => {
        const appRefs = applicationIds.map((id) =>
          this.db.collection('applications').doc(id),
        );
        const assignmentRefs = applicationIds.map((id) =>
          this.db.collection('applicationAssignments').doc(id),
        );
        const [apps, current] = await Promise.all([
          Promise.all(appRefs.map((ref) => tx.get(ref))),
          Promise.all(assignmentRefs.map((ref) => tx.get(ref))),
        ]);
        const at = Timestamp.fromMillis(this.now());
        let changed = 0;
        apps.forEach((snapshot, index) => {
          const app = snapshot.data();
          // Outra organização ou inexistente: igual a não existir (D14).
          if (!app || app.organizationId !== organizationId)
            throw new Abort('NOT_FOUND');
          const jobId = String(app.jobId ?? '');
          const resource = { organizationId, jobId };
          if (
            !can(actor.permission, 'view_application', resource) ||
            !can(actor.permission, 'change_application_status', resource)
          )
            throw new Abort('FORBIDDEN');
          if (!isAssignable(String(app.v2Status)))
            throw new Abort(
              'INVALID_INPUT',
              'Só candidaturas em curso podem ser atribuídas.',
            );
          if (
            assignee &&
            !can(assignee.permission, 'view_application', resource)
          )
            throw new Abort(
              'INVALID_INPUT',
              'Esta pessoa não tem acesso a uma das vagas. Junte-a primeiro à equipa da vaga.',
            );
          const previous = current[index]?.data();
          const before =
            typeof previous?.userId === 'string' ? previous.userId : null;
          if (before === assigneeUserId) return;
          changed += 1;
          tx.set(
            this.db
              .collection('applicationAssignments')
              .doc(applicationIds[index] as string),
            {
              applicationId: applicationIds[index],
              organizationId,
              jobId,
              userId: assigneeUserId,
              previousUserId: before,
              assignedBy: userId,
              assignedAt: at,
              version: (Number(previous?.version) || 0) + 1,
            },
          );
          // R94/R95: só a pessoa que recebe, só in-app, e nunca a si própria.
          if (assigneeUserId && assigneeUserId !== userId)
            tx.create(this.db.collection('outboxEvents').doc(), {
              type: 'application_assigned',
              schemaVersion: 1,
              payload: {
                applicationId: applicationIds[index],
                assigneeUserId,
              },
              status: 'PENDING',
              attempts: 0,
              createdAtMs: this.now(),
              nextAttemptAtMs: this.now(),
            });
        });
        if (changed)
          // R71/H4: ids e contagem, nunca nomes.
          tx.create(this.db.collection('auditLogs').doc(), {
            actorId: userId,
            actorType: 'EMPLOYER',
            action:
              changed > 1
                ? 'applications_bulk_assigned'
                : 'application_assigned',
            resourceType: 'Application',
            resourceId: applicationIds.length === 1 ? applicationIds[0] : null,
            organizationId,
            metadata: {
              count: changed,
              assigneeUserId,
              applicationIds,
            },
            at,
          });
        return changed;
      });
      return success({ updated, assigneeUserId });
    } catch (error) {
      if (error instanceof Abort) return failure(error.code, error.message);
      throw error;
    }
  }
}
