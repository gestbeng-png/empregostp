import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { CONSENT_KINDS, LEGAL_DOCUMENTS, validLegalVersion } from '@/domain/privacy/Consent';
import type { ConsentRecord, TermsAcceptance } from '@/domain/privacy/Consent';
import { failure, success } from '@/domain/shared/Result';
import type { Result } from '@/domain/shared/Result';
import { isUserAccountActive } from '@/lib/userStatus';

import { digest, validDocumentId } from './identifiers';

/** Append-only infrastructure, no route or legal text publishing. Callers must
 * authenticate a revoked-checked token and bind userId to that principal. */
export class FirestorePrivacyLedger {
  constructor(private readonly db: Firestore, private readonly now: () => number = Date.now) {}
  async recordConsent(input: Omit<ConsentRecord, 'atMs'>, key: string): Promise<Result<{ id: string }>> {
    if (!CONSENT_KINDS.includes(input.kind) || typeof input.granted !== 'boolean' || !['SETTINGS', 'REGISTRATION', 'TALENT_OPT_IN'].includes(input.source)) return failure('INVALID_INPUT');
    return this.append('consents', input, key, 'consent_recorded');
  }
  async acceptTerms(input: Omit<TermsAcceptance, 'atMs'>, key: string): Promise<Result<{ id: string }>> {
    if (!LEGAL_DOCUMENTS.includes(input.document)) return failure('INVALID_INPUT');
    return this.append('termsAcceptances', input, key, 'terms_accepted');
  }
  private async append(collection: string, input: Omit<ConsentRecord, 'atMs'> | Omit<TermsAcceptance, 'atMs'>, key: string, eventType: 'consent_recorded' | 'terms_accepted'): Promise<Result<{ id: string }>> {
    if (!validDocumentId(input.userId) || !validLegalVersion(input.version, input.contentSha256) || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) return failure('INVALID_INPUT');
    // Fixed field order, no user-submitted extra fields or PII persisted.
    const legal = { userId: input.userId, version: input.version, contentSha256: input.contentSha256, ...('kind' in input ? { kind: input.kind, granted: input.granted, source: input.source } : { document: input.document }) };
    const id = digest([collection, input.userId, key]);
    const ref = this.db.collection(collection).doc(id);
    const audit = this.db.collection('auditLogs').doc();
    const event = this.db.collection('outboxEvents').doc();
    return this.db.runTransaction(async (tx) => {
      const [previous, user] = await Promise.all([tx.get(ref), tx.get(this.db.collection('users').doc(input.userId))]);
      if (!user.exists || !isUserAccountActive(user.data())) return failure('FORBIDDEN');
      const hash = digest(legal);
      if (previous.exists) return previous.data()?.requestHash === hash ? success({ id }) : failure('IDEMPOTENCY_CONFLICT');
      const now = this.now();
      tx.create(ref, { ...legal, atMs: now, requestHash: hash });
      tx.create(audit, { actorId: input.userId, actorType: 'USER', action: eventType, resourceType: collection, resourceId: id, metadata: {}, at: Timestamp.fromMillis(now) });
      tx.create(event, { type: eventType, schemaVersion: 1, payload: { [eventType === 'consent_recorded' ? 'consentId' : 'acceptanceId']: id, userId: input.userId }, status: 'PENDING', attempts: 0, createdAtMs: now, nextAttemptAtMs: now });
      return success({ id });
    });
  }
}
