import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { createApplicationTransitionPolicy } from '@/application/applications/applicationTransitionPolicy';
import {
  candidateStatusLabel,
  CLOSED_REASONS,
} from '@/domain/applications/candidateView';
import {
  DEFAULT_REJECTION_TEMPLATES,
  renderCandidateTemplate,
} from '@/domain/applications/jobEnd';
import type { ApplicationStatus } from '@/domain/applications/states';
import { canUseFeature } from '@/domain/entitlements/canUseFeature';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { Result } from '@/domain/shared/Result';

import { validateCandidateMessage } from '../jobs/FirestoreJobClosingService';
import {
  FirestoreLifecycleStore,
  resolveIdentity,
} from '../marketplace/FirestoreLifecycleStore';
import { validDocumentId } from '../marketplace/identifiers';

export const BULK_UNDO_WINDOW_MS = 10_000;
export const BULK_TYPED_CONFIRMATION_FROM = 20;
const MAX_BULK = 200;
const TEMPLATE_KEYS = ['NOT_SELECTED', 'PROCESS_CLOSED'] as const;
type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface BulkPreview {
  bulkId: string;
  count: number;
  confirmationText: string;
  messagePreview: string | null;
  executeAfter: string;
}

/**
 * F3.2 — ações em lote em duas fases: `prepare` grava a intenção (contagem
 * exata, mensagem pré-visualizada) e só `execute`, ≥ 10 s depois, muda
 * estados e põe mensagens na outbox; até lá `cancel` desfaz sem efeito
 * nenhum. ≥ 20 candidaturas exigem escrever o número. Auditado (H4).
 */
export class FirestoreBulkActionService {
  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  async templates(
    userId: string,
    organizationId: string,
  ): Promise<Result<Record<TemplateKey, string>>> {
    const allowed = await this.member(userId, organizationId);
    if (!allowed) return failure('FORBIDDEN');
    const saved =
      (
        await this.db
          .collection('orgMessageTemplates')
          .doc(organizationId)
          .get()
      ).data() ?? {};
    return success(
      Object.fromEntries(
        TEMPLATE_KEYS.map((key) => [
          key,
          typeof saved[key] === 'string'
            ? saved[key]
            : DEFAULT_REJECTION_TEMPLATES[key],
        ]),
      ) as Record<TemplateKey, string>,
    );
  }

  async saveTemplates(
    userId: string,
    organizationId: string,
    input: Record<string, unknown>,
  ): Promise<Result<{ saved: true }>> {
    if (!(await this.member(userId, organizationId)))
      return failure('FORBIDDEN');
    const update: Record<string, unknown> = {};
    for (const key of TEMPLATE_KEYS) {
      if (input[key] === undefined) continue;
      const text = validateCandidateMessage(input[key]);
      if (!text)
        return failure(
          'INVALID_INPUT',
          'Os modelos só podem usar {nome}, {vaga} e {organizacao} e ter 20 a 1500 caracteres.',
        );
      update[key] = text;
    }
    if (!Object.keys(update).length) return failure('INVALID_INPUT');
    await this.db
      .collection('orgMessageTemplates')
      .doc(organizationId)
      .set(
        {
          ...update,
          updatedAt: Timestamp.fromMillis(this.now()),
          updatedBy: userId,
        },
        { merge: true },
      );
    return success({ saved: true });
  }

  private async member(userId: string, organizationId: string) {
    if (!validDocumentId(organizationId)) return null;
    const identity = await resolveIdentity(
      this.db,
      { get: (r: { get: () => unknown }) => r.get() } as never,
      userId,
      organizationId,
    );
    return identity &&
      can(identity.permission, 'change_application_status', { organizationId })
      ? identity
      : null;
  }

  async prepare(
    userId: string,
    input: Record<string, unknown>,
  ): Promise<Result<BulkPreview>> {
    const ids = Array.isArray(input.applicationIds)
      ? [
          ...new Set(
            input.applicationIds.filter((id): id is string =>
              validDocumentId(id),
            ),
          ),
        ]
      : [];
    const to = String(input.to ?? '') as ApplicationStatus;
    if (!ids.length || ids.length > MAX_BULK)
      return failure(
        'INVALID_INPUT',
        `Escolha entre 1 e ${MAX_BULK} candidaturas.`,
      );
    const closedReason =
      typeof input.closedReason === 'string' ? input.closedReason : undefined;
    if (
      to === 'REJECTED' &&
      !(CLOSED_REASONS as readonly string[]).includes(closedReason ?? '')
    )
      return failure('INVALID_INPUT', 'Indique o motivo do fecho.');
    if (
      ids.length >= BULK_TYPED_CONFIRMATION_FROM &&
      Number(input.typedCount) !== ids.length
    )
      return failure('INVALID_INPUT', `Escreva ${ids.length} para confirmar.`);
    const apps = await Promise.all(
      ids.map((id) => this.db.collection('applications').doc(id).get()),
    );
    const organizations = new Set(
      apps.map((doc) => doc.data()?.organizationId),
    );
    if (
      apps.some(
        (doc) => !doc.exists || typeof doc.data()?.v2Status !== 'string',
      ) ||
      organizations.size !== 1
    )
      return failure('NOT_FOUND');
    const organizationId = String([...organizations][0]);
    if (!(await this.member(userId, organizationId)))
      return failure('FORBIDDEN');
    const entitlement = canUseFeature(
      { type: 'ORGANIZATION', id: organizationId },
      'ATS_BULK_ACTIONS',
      [],
      {
        now: this.now(),
        requested: ids.length,
      },
    );
    if (
      !entitlement.allowed &&
      entitlement.limit !== null &&
      ids.length > entitlement.limit
    )
      return failure(
        'INVALID_INPUT',
        `No seu plano, cada ação em lote pode ter até ${entitlement.limit} candidaturas.`,
      );
    // Mensagem: obrigatória ao rejeitar (F3.6 — nunca sem pré-visualização).
    let template: string | null = null;
    if (to === 'REJECTED') {
      const key: TemplateKey = closedReason?.startsWith('POSITION_')
        ? 'PROCESS_CLOSED'
        : 'NOT_SELECTED';
      const saved = await this.templates(userId, organizationId);
      template =
        input.message === undefined
          ? saved.ok
            ? saved.value[key]
            : DEFAULT_REJECTION_TEMPLATES[key]
          : validateCandidateMessage(input.message);
      if (!template) return failure('INVALID_INPUT', 'Mensagem inválida.');
    }
    const first = apps[0]?.data() ?? {};
    const vars = (app: Record<string, unknown>) => ({
      nome:
        String(
          (app.candidateSnapshot as Record<string, unknown> | undefined)
            ?.fullName ??
            app.candidateName ??
            '',
        ).split(' ')[0] ?? '',
      vaga: String(
        (app.jobSnapshot as Record<string, unknown> | undefined)?.titulo ??
          app.jobTitle ??
          '',
      ),
      organizacao: String(
        (app.jobSnapshot as Record<string, unknown> | undefined)?.companyName ??
          app.company ??
          '',
      ),
    });
    const label = candidateStatusLabel(to, closedReason ?? null);
    const ref = this.db.collection('bulkActions').doc();
    const executeAfterMs = this.now() + BULK_UNDO_WINDOW_MS;
    await ref.create({
      organizationId,
      createdBy: userId,
      applicationIds: ids,
      to,
      closedReason: closedReason ?? null,
      template,
      status: 'PENDING',
      executeAfterMs,
      createdAt: Timestamp.fromMillis(this.now()),
    });
    return success({
      bulkId: ref.id,
      count: ids.length,
      confirmationText: `Vai marcar ${ids.length} ${ids.length === 1 ? 'candidatura' : 'candidaturas'} como «${label}»${template ? ' e enviar esta mensagem' : ''}.`,
      messagePreview: template
        ? renderCandidateTemplate(template, vars(first))
        : null,
      executeAfter: new Date(executeAfterMs).toISOString(),
    });
  }

  async cancel(
    userId: string,
    bulkId: string,
  ): Promise<Result<{ status: 'CANCELLED' }>> {
    if (!validDocumentId(bulkId)) return failure('NOT_FOUND');
    const ref = this.db.collection('bulkActions').doc(bulkId);
    const cancelled = await this.db.runTransaction(async (tx) => {
      const bulk = (await tx.get(ref)).data();
      if (!bulk || bulk.createdBy !== userId || bulk.status !== 'PENDING')
        return false;
      tx.update(ref, {
        status: 'CANCELLED',
        cancelledAt: Timestamp.fromMillis(this.now()),
      });
      return true;
    });
    return cancelled
      ? success({ status: 'CANCELLED' })
      : failure('INVALID_TRANSITION');
  }

  async execute(
    userId: string,
    bulkId: string,
  ): Promise<Result<{ updated: number; failed: number }>> {
    if (!validDocumentId(bulkId)) return failure('NOT_FOUND');
    const ref = this.db.collection('bulkActions').doc(bulkId);
    const claimed = await this.db.runTransaction(async (tx) => {
      const bulk = (await tx.get(ref)).data();
      if (!bulk || bulk.createdBy !== userId) return 'NOT_FOUND';
      if (bulk.status !== 'PENDING') return 'NOT_PENDING';
      if (this.now() < Number(bulk.executeAfterMs)) return 'TOO_EARLY';
      tx.update(ref, {
        status: 'RUNNING',
        startedAt: Timestamp.fromMillis(this.now()),
      });
      return bulk;
    });
    if (claimed === 'NOT_FOUND') return failure('NOT_FOUND');
    if (typeof claimed === 'string')
      return failure(
        'INVALID_TRANSITION',
        claimed === 'TOO_EARLY'
          ? 'Aguarde o fim do período para desfazer.'
          : undefined,
      );
    const store = new FirestoreLifecycleStore(this.db, this.now);
    const result = { updated: 0, failed: 0 };
    for (const id of claimed.applicationIds as string[]) {
      const app =
        (await this.db.collection('applications').doc(id).get()).data() ?? {};
      const snapshot = (app.candidateSnapshot ?? {}) as Record<string, unknown>;
      const job = (app.jobSnapshot ?? {}) as Record<string, unknown>;
      const note = claimed.template
        ? renderCandidateTemplate(String(claimed.template), {
            nome:
              String(snapshot.fullName ?? app.candidateName ?? '').split(
                ' ',
              )[0] ?? '',
            vaga: String(job.titulo ?? app.jobTitle ?? ''),
            organizacao: String(job.companyName ?? app.company ?? ''),
          })
        : undefined;
      const outcome = await store.transition(
        {
          kind: 'Application',
          entityId: id,
          to: String(claimed.to),
          expectedVersion: Number(app.version) || 0,
          actorUserId: userId,
          idempotencyKey: `bulk_${bulkId}_${id}`.slice(0, 128),
          ...(claimed.closedReason
            ? { closedReason: String(claimed.closedReason) }
            : {}),
          ...(note ? { candidateVisibleNote: note } : {}),
        },
        createApplicationTransitionPolicy(String(claimed.to), this.now),
      );
      if (outcome.ok) result.updated++;
      else result.failed++;
    }
    await ref.update({
      status: 'DONE',
      ...result,
      finishedAt: Timestamp.fromMillis(this.now()),
    });
    await this.db
      .collection('auditLogs')
      .doc()
      .create({
        actorId: userId,
        actorType: 'EMPLOYER',
        action: 'applications_bulk_transition',
        resourceType: 'BulkAction',
        resourceId: bulkId,
        organizationId: claimed.organizationId,
        metadata: {
          to: claimed.to,
          count: (claimed.applicationIds as string[]).length,
          ...result,
        },
        at: Timestamp.fromMillis(this.now()),
      });
    return success(result);
  }
}
