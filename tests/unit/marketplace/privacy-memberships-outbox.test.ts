import { planMembershipBackfill } from '@/domain/memberships/Membership';
import { validEventPayload } from '@/domain/outbox/events';
import { afterFailure, canClaim, RETRY_DELAYS_MS } from '@/domain/outbox/OutboxEvent';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';
import { hasConsent, validLegalVersion } from '@/domain/privacy/Consent';
import type { ConsentRecord } from '@/domain/privacy/Consent';
import { RATE_LIMIT_POLICIES } from '@/domain/rate-limits/policies';

export const event = (changes: Partial<OutboxEvent> = {}): OutboxEvent => ({ id: 'event-a', type: 'entity_status_changed', schemaVersion: 1, payload: { entityId: 'job-a', entityKind: 'Job', version: 1 }, status: 'PENDING', attempts: 0, createdAtMs: 0, nextAttemptAtMs: 1000, ...changes });

describe('Outbox pure retry and claims', () => {
  test('due, lease expiry, terminal and malformed counts', () => {
    expect(canClaim(event(), 999)).toBe(false);
    expect(canClaim(event(), 1000)).toBe(true);
    expect(canClaim(event({ status: 'FAILED' }), 1000)).toBe(true);
    expect(canClaim(event({ status: 'PROCESSING', leaseUntilMs: 1001 }), 1000)).toBe(false);
    expect(canClaim(event({ status: 'PROCESSING', leaseUntilMs: 1000 }), 1000)).toBe(true);
    expect(canClaim(event({ status: 'PROCESSING' }), 1000)).toBe(false);
    for (const status of ['DONE', 'DEAD'] as const) expect(canClaim(event({ status }), 1000)).toBe(false);
    for (const attempts of [-1, 6, 1.5, NaN]) expect(canClaim(event({ attempts }), 1000)).toBe(false);
    expect(canClaim(event(), NaN)).toBe(false);
  });
  test('all five retry delays then dead-letter', () => {
    let item = event();
    RETRY_DELAYS_MS.forEach((delay, index) => { const failure = afterFailure(item, 1000); expect(failure).toEqual({ status: 'FAILED', attempts: index + 1, nextAttemptAtMs: 1000 + delay }); item = { ...item, ...failure }; });
    expect(afterFailure(item, 2000)).toEqual({ status: 'DEAD', attempts: 5, nextAttemptAtMs: 2000 });
  });
  test('event schema forbids arbitrary PII and invalid identifiers', () => {
    expect(validEventPayload('entity_status_changed', event().payload)).toBe(true);
    expect(validEventPayload('consent_recorded', { consentId: 'c', userId: 'u' })).toBe(true);
    expect(validEventPayload('terms_accepted', { acceptanceId: 'a', userId: 'u' })).toBe(true);
    for (const payload of [null, [], { ...event().payload, email: 'synthetic@example.test' }, { ...event().payload, version: 0 }, { ...event().payload, entityId: 'a/b' }, { ...event().payload, entityId: '' }, { ...event().payload, entityId: 'a'.repeat(513) }, { entityId: 'x' }]) expect(validEventPayload('entity_status_changed', payload)).toBe(false);
    expect(validEventPayload('__proto__', {})).toBe(false);
  });
});
describe('Membership expand planner', () => {
  test('legacy company becomes owner, suspended accounts stay suspended, others ignored', () => {
    const source = [{ id: 'company', userType: 'empresa' }, { id: 'suspended', userType: 'empresa', status: 'Suspended' }, { id: 'candidate', userType: 'candidato' }];
    const plan = planMembershipBackfill(source, [], 1000);
    expect(plan.memberships).toHaveLength(2);
    expect(plan.memberships[0]).toMatchObject({ userId: 'company', organizationId: 'company', role: 'OWNER', status: 'ACTIVE' });
    expect(plan.memberships[1]?.status).toBe('SUSPENDED');
    expect(planMembershipBackfill(source, plan.organizations, 1000).organizations).toEqual([]);
    expect(source[0]).toEqual({ id: 'company', userType: 'empresa' });
  });
  test('ambiguous owner/multi org/unsafe ids go to manual review, never guessed', () => {
    const plan = planMembershipBackfill([{ id: 'a', userType: 'empresa', organizationIds: ['org-a', 'org-b'] }, { id: 'b', userType: 'empresa', organizationId: 'unknown' }, { id: 'c', userType: 'empresa', organizationId: 'known' }, { id: 'bad/id', userType: 'empresa' }], [{ id: 'known', ownerUserId: 'other' }], 1000);
    expect(plan.memberships).toEqual([]);
    expect(plan.ambiguous.map((item) => item.code)).toEqual(['MULTIPLE_ORGANIZATIONS', 'OWNER_NOT_CONFIRMED', 'OWNER_NOT_CONFIRMED', 'INVALID_ID']);
    expect(planMembershipBackfill([{ id: 'a', userType: 'empresa', organizationId: 'org-a', companyId: 'org-a' }], [{ id: 'org-a', ownerUserId: 'a' }], 1000).memberships).toHaveLength(1);
    expect(planMembershipBackfill([{ id: 'a', userType: 'empresa' }], [], NaN).memberships).toEqual([]);
  });
});
describe('Consent is explicit and reversible, legal versions immutable', () => {
  const record: ConsentRecord = { userId: 'user-a', kind: 'MARKETING_EMAIL', granted: true, version: 'v1', contentSha256: 'a'.repeat(64), source: 'SETTINGS', atMs: 1000 };
  test('no implicit consent, latest revocation wins incl ties', () => {
    expect(hasConsent([], 'user-a', 'MARKETING_EMAIL')).toBe(false);
    expect(hasConsent([record], 'user-a', 'MARKETING_EMAIL', 'v1')).toBe(true);
    expect(hasConsent([record], 'other', 'MARKETING_EMAIL')).toBe(false);
    expect(hasConsent([record], 'user-a', 'MARKETING_WHATSAPP')).toBe(false);
    expect(hasConsent([record], 'user-a', 'MARKETING_EMAIL', 'v2')).toBe(false);
    expect(hasConsent([record, { ...record, atMs: 2000, granted: false }], 'user-a', 'MARKETING_EMAIL')).toBe(false);
    expect(hasConsent([record, { ...record, granted: false }], 'user-a', 'MARKETING_EMAIL')).toBe(false);
    expect(hasConsent([{ ...record, atMs: NaN }], 'user-a', 'MARKETING_EMAIL')).toBe(false);
  });
  test('version and sha256 validated', () => {
    expect(validLegalVersion('2026-10-08', 'a'.repeat(64))).toBe(true);
    expect(validLegalVersion('contains text', 'a'.repeat(64))).toBe(false);
    expect(validLegalVersion('v1', 'not-a-digest')).toBe(false);
  });
  test('anti-spam application quotas cannot be bought', () => {
    expect(RATE_LIMIT_POLICIES.application_submit).toEqual([{ subject: 'USER', limit: 5, windowMs: 600_000 }, { subject: 'USER', limit: 25, windowMs: 86_400_000 }]);
    expect(RATE_LIMIT_POLICIES.login[0]).toEqual({ subject: 'ACCOUNT_IP', limit: 5, windowMs: 900_000 });
  });
});
