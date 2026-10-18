import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { assertTransition as applicationTransition } from '@/domain/applications/states';
import type { ApplicationStatus } from '@/domain/applications/states';
import { legacyStatusUpdate } from '@/domain/lifecycle/legacyStatus';
import { assertTransition as offerTransition } from '@/domain/offers/states';
import type { OfferStatus } from '@/domain/offers/states';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';
import type { DomainErrorCode, Result } from '@/domain/shared/Result';

import { resolveIdentity } from '../marketplace/FirestoreLifecycleStore';
import { digest, validDocumentId } from '../marketplace/identifiers';

type Data = Record<string, unknown>;
class Abort extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message || code);
  }
}
const date = (value: unknown): number => {
  if (value && typeof value === 'object' && 'toMillis' in value)
    return (value as { toMillis(): number }).toMillis();
  return Date.parse(String(value || ''));
};

export function candidateOfferView(
  id: string,
  data: Data,
  now = Date.now(),
): Data {
  return {
    id,
    version: Number(data.version) || 0,
    status:
      data.v2Status === 'SENT' && date(data.expiresAt) <= now
        ? 'EXPIRED'
        : String(data.v2Status),
    amountMinor: data.amountMinor,
    currency: data.currency,
    period: data.period,
    startDate: data.startDate,
    expiresAt: Number.isFinite(date(data.expiresAt))
      ? new Date(date(data.expiresAt)).toISOString()
      : null,
    message: data.message || '',
    legalNotice: data.legalNotice || '',
  };
}

/** Ofertas na mesma base e candidatura. Permissões e versão relidas na transação. */
export class FirestoreOfferService {
  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  async list(uid: string, applicationId: string): Promise<Result<unknown>> {
    return this.run(uid, applicationId, null);
  }

  async act(
    uid: string,
    applicationId: string,
    input: Data,
  ): Promise<Result<unknown>> {
    return this.run(uid, applicationId, input);
  }

  private async run(
    uid: string,
    applicationId: string,
    input: Data | null,
  ): Promise<Result<unknown>> {
    if (!validDocumentId(uid) || !validDocumentId(applicationId))
      return failure('NOT_FOUND');
    try {
      return success(
        await this.db.runTransaction(async (tx) => {
          const appRef = this.db.collection('applications').doc(applicationId);
          const app = (await tx.get(appRef)).data();
          if (!app || typeof app.organizationId !== 'string')
            throw new Abort('NOT_FOUND');
          const identity = await resolveIdentity(
            this.db,
            tx,
            uid,
            app.organizationId,
          );
          const candidate =
            app.candidateUserId === uid || app.candidateId === uid;
          const resource = {
            organizationId: app.organizationId,
            jobId: String(app.jobId || ''),
          };
          if (
            !identity ||
            (!candidate &&
              !can(identity.permission, 'view_application', resource))
          )
            throw new Abort('NOT_FOUND');
          const offers = await tx.get(
            this.db
              .collection('offers')
              .where('applicationId', '==', applicationId),
          );
          if (!input)
            return {
              offers: offers.docs
                .filter((doc) => !candidate || doc.data().v2Status !== 'DRAFT')
                .map((doc) =>
                  candidateOfferView(doc.id, doc.data(), this.now()),
                ),
            };
          const action = String(input.action || '');
          const candidateAction = action === 'accept' || action === 'decline';
          if (
            !['save', 'send', 'accept', 'decline', 'withdraw'].includes(action)
          )
            throw new Abort('INVALID_INPUT');
          if (
            candidateAction
              ? !candidate
              : candidate ||
                !can(identity.permission, 'interview_offer', resource)
          )
            throw new Abort('FORBIDDEN');
          const key = String(input.idempotencyKey || '');
          if (!/^[A-Za-z0-9_-]{16,128}$/.test(key))
            throw new Abort('INVALID_INPUT');
          const receiptRef = this.db
            .collection('offerCommands')
            .doc(digest([uid, applicationId, key]));
          const fingerprint = digest([JSON.stringify(input)]);
          const receipt = (await tx.get(receiptRef)).data();
          if (receipt) {
            if (receipt.fingerprint !== fingerprint)
              throw new Abort('IDEMPOTENCY_CONFLICT');
            return receipt.result;
          }
          const existing = offers.docs.find((doc) => doc.id === input.offerId);
          if (input.offerId && !existing) throw new Abort('NOT_FOUND');
          if (!existing && action !== 'save' && action !== 'send')
            throw new Abort('NOT_FOUND');
          if (
            !existing &&
            offers.docs.some((doc) =>
              ['DRAFT', 'SENT', 'ACCEPTED'].includes(doc.data().v2Status),
            )
          )
            throw new Abort(
              'VERSION_CONFLICT',
              'Já existe uma oferta neste processo. Recarregue os dados.',
            );
          const ref =
            existing?.ref ||
            this.db
              .collection('offers')
              .doc(digest([applicationId, uid, key]).slice(0, 28));
          const previous = existing?.data();
          if (previous && input.expectedVersion !== previous.version)
            throw new Abort('VERSION_CONFLICT');
          let data: Data = previous || {};
          const at = Timestamp.fromMillis(this.now());
          if (action === 'save' || action === 'send') {
            if (previous && previous.v2Status !== 'DRAFT')
              throw new Abort('INVALID_TRANSITION');
            if (!['SHORTLISTED', 'INTERVIEW'].includes(app.v2Status))
              throw new Abort(
                'INVALID_TRANSITION',
                'Selecione ou entreviste o candidato antes de preparar uma oferta.',
              );
            const amount = input.amountMinor;
            const expires = date(input.expiresAt);
            const startDate = String(input.startDate || '');
            if (
              !Number.isSafeInteger(amount) ||
              Number(amount) <= 0 ||
              !['STN', 'EUR'].includes(String(input.currency)) ||
              !['HOUR', 'DAY', 'MONTH', 'YEAR'].includes(
                String(input.period),
              ) ||
              !Number.isFinite(expires) ||
              expires <= this.now() ||
              !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
              !Number.isFinite(date(startDate)) ||
              new Date(startDate).toISOString().slice(0, 10) !== startDate ||
              typeof input.message !== 'string' ||
              input.message.length > 4000
            )
              throw new Abort(
                'INVALID_INPUT',
                'Indique salário, moeda, período, data de início e validade futura.',
              );
            data = {
              ...data,
              applicationId,
              organizationId: app.organizationId,
              jobId: app.jobId,
              candidateUserId: app.candidateUserId || app.candidateId,
              amountMinor: amount,
              currency: input.currency,
              period: input.period,
              startDate,
              expiresAt: Timestamp.fromMillis(expires),
              message: input.message.trim(),
              v2Status: action === 'save' ? 'DRAFT' : 'SENT',
              createdAt: previous?.createdAt || at,
              createdBy: previous?.createdBy || uid,
            };
          } else {
            const target =
              action === 'accept'
                ? 'ACCEPTED'
                : action === 'decline'
                  ? 'DECLINED'
                  : 'WITHDRAWN';
            if (candidateAction && app.v2Status !== 'OFFER')
              throw new Abort('INVALID_TRANSITION');
            const moved = offerTransition(
              previous?.v2Status as OfferStatus,
              target,
              candidateAction ? 'CANDIDATE' : identity.transition,
              {
                guards: {
                  offerUnexpired: date(previous?.expiresAt) > this.now(),
                },
              },
            );
            if (!moved.ok)
              throw new Abort(moved.error.code, moved.error.message);
            data = { ...data, v2Status: target };
          }
          if (action === 'send') {
            const moved = applicationTransition(
              app.v2Status as ApplicationStatus,
              'OFFER',
              identity.transition,
              { guards: { offerSent: true } },
            );
            if (!moved.ok)
              throw new Abort(moved.error.code, moved.error.message);
          }
          const version = Number(previous?.version || 0) + 1;
          data = { ...data, version, updatedAt: at };
          tx.set(ref, data);
          tx.create(this.db.collection('offersStatusHistory').doc(), {
            entityId: ref.id,
            from: previous?.v2Status || null,
            to: data.v2Status,
            actorId: uid,
            actorType: candidateAction ? 'CANDIDATE' : identity.transition,
            version,
            at,
          });
          if (action === 'send' || action === 'decline') {
            const to = action === 'send' ? 'OFFER' : 'OFFER_DECLINED';
            const appVersion = Number(app.version || 0) + 1;
            const legacy = legacyStatusUpdate('Application', to);
            tx.update(appRef, {
              ...(legacy.ok ? legacy.value : {}),
              v2Status: to,
              version: appVersion,
              lastStatusChangeAt: at,
            });
            tx.create(this.db.collection('applicationsStatusHistory').doc(), {
              entityId: applicationId,
              from: app.v2Status,
              to,
              version: appVersion,
              actorId: uid,
              actorType: candidateAction ? 'SYSTEM' : identity.transition,
              at,
            });
          }
          if (action !== 'save') this.notify(tx, ref.id, version);
          const result = {
            offer: candidateOfferView(ref.id, data, this.now()),
          };
          tx.create(receiptRef, { fingerprint, result, createdAt: at });
          return result;
        }),
      );
    } catch (error) {
      if (error instanceof Abort) return failure(error.code, error.message);
      throw error;
    }
  }

  private notify(tx: Transaction, id: string, version: number) {
    tx.create(this.db.collection('outboxEvents').doc(), {
      type: 'entity_status_changed',
      schemaVersion: 1,
      payload: { entityId: id, entityKind: 'Offer', version },
      status: 'PENDING',
      attempts: 0,
      createdAtMs: this.now(),
      nextAttemptAtMs: this.now(),
    });
  }
}
