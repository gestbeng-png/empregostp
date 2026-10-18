import { canUseFeature, ENTITLEMENT_KEYS } from '@/domain/entitlements/canUseFeature';
import type { EntitlementGrant, EntitlementKey } from '@/domain/entitlements/canUseFeature';
import { DEFAULT_FLAGS, FEATURE_KEYS, isEnabled } from '@/domain/feature-flags/flags';

const organization = { type: 'ORGANIZATION' as const, id: 'org-a' };
const candidate = { type: 'CANDIDATE' as const, id: 'user-a' };
const now = 100_000;
const options = { now, v2Enabled: true };
const grant = (changes: Partial<EntitlementGrant> = {}): EntitlementGrant => ({ subjectType: 'ORGANIZATION', subjectId: 'org-a', feature: 'JOB_POST_SLOTS', quantity: 5, source: 'PLAN', validFrom: 0, ...changes });

describe('Feature flags and kill switches', () => {
  test.each(FEATURE_KEYS)('%s defaults off including production', (key) => {
    expect(isEnabled(key, DEFAULT_FLAGS[key], { environment: 'production' })).toBe(false);
    expect(Object.isFrozen(DEFAULT_FLAGS[key])).toBe(true);
  });
  test('enabled, environment, allowlists, stable rollout', () => {
    const ctx = { environment: 'staging' as const, userId: 'user-a' };
    expect(isEnabled('V2_SEARCH', undefined, ctx)).toBe(false);
    expect(isEnabled('V2_SEARCH', { enabled: true }, ctx)).toBe(true);
    expect(isEnabled('V2_SEARCH', { enabled: true, environments: ['production'], allowUserIds: ['user-a'] }, ctx)).toBe(false);
    expect(isEnabled('V2_SEARCH', { enabled: true, rolloutPercent: 0, allowUserIds: ['user-a'] }, ctx)).toBe(true);
    expect(isEnabled('V2_SEARCH', { enabled: true, rolloutPercent: 0, allowOrgIds: ['org-a'] }, { ...ctx, organizationId: 'org-a' })).toBe(true);
    for (const value of [-1, 0, 101, NaN, Infinity]) expect(isEnabled('V2_SEARCH', { enabled: true, rolloutPercent: value }, ctx)).toBe(false);
    expect(isEnabled('V2_SEARCH', { enabled: true, rolloutPercent: 50 }, { environment: 'staging' })).toBe(false);
    const values = Array.from({ length: 1000 }, (_, i) => isEnabled('V2_SEARCH', { enabled: true, rolloutPercent: 50 }, { ...ctx, userId: `synthetic-${i}` }));
    expect(values.filter(Boolean).length).toBeGreaterThan(300);
    expect(values.filter(Boolean).length).toBeLessThan(700);
    expect(isEnabled('V2_SEARCH', { enabled: true, rolloutPercent: 50 }, ctx)).toBe(isEnabled('V2_SEARCH', { enabled: true, rolloutPercent: 50 }, ctx));
  });
  test.each(['KILL_AI', 'KILL_WHATSAPP', 'KILL_OUTBOUND_EMAIL_MARKETING'] as const)('%s ignores allowlists and rollout', (key) => expect(isEnabled(key, { enabled: true, rolloutPercent: 0, environments: ['staging'] }, { environment: 'production' })).toBe(true));
});

describe('Entitlements: default free, settlement, audience and quotas', () => {
  test.each(ENTITLEMENT_KEYS)('%s off returns unchanged legacy result', (feature) => {
    const legacy = { allowed: true, limit: 777 };
    expect(canUseFeature(organization, feature, [], { ...options, v2Enabled: false, legacyDecision: legacy })).toBe(legacy);
    expect(canUseFeature(organization, feature, [], { ...options, v2Enabled: false }).code).toBe('FEATURE_DISABLED');
  });
  test('free quotas and plan replacing free, topups stacking, unlimited', () => {
    expect(canUseFeature(organization, 'JOB_POST_SLOTS', [], options)).toEqual({ allowed: true, limit: 1 });
    expect(canUseFeature(candidate, 'CV_DOCUMENTS', [], options)).toEqual({ allowed: true, limit: 2 });
    expect(canUseFeature(organization, 'JOB_POST_SLOTS', [grant(), grant()], options)).toEqual({ allowed: true, limit: 5 });
    expect(canUseFeature(organization, 'JOB_POST_SLOTS', [grant(), grant({ source: 'PURCHASE', paymentStatus: 'PAID', quantity: 2 })], options).limit).toBe(7);
    expect(canUseFeature(organization, 'JOB_POST_SLOTS', [grant({ quantity: null })], { ...options, used: 999 })).toEqual({ allowed: true, limit: null });
    expect(canUseFeature(organization, 'TALENT_SEARCH', [], options).code).toBe('ENTITLEMENT_REQUIRED');
    expect(canUseFeature(organization, 'JOB_POST_SLOTS', [], { ...options, used: 1 }).code).toBe('LIMIT_REACHED');
  });
  test.each([
    { subjectId: 'org-b' }, { subjectType: 'CANDIDATE' as const }, { feature: 'EXPORT' as const }, { revoked: true }, { validFrom: now + 1 }, { validFrom: NaN }, { validUntil: now }, { validUntil: NaN }, { source: 'PURCHASE' as const }, { quantity: -1 }, { quantity: 1.5 }, { quantity: Number.MAX_SAFE_INTEGER + 1 },
  ])('invalid/expired/wrong grant ignored: %j', (changes) => expect(canUseFeature(organization, 'JOB_POST_SLOTS', [grant(changes)], options).limit).toBe(1));
  test('education exception only organization internships', () => {
    expect(canUseFeature({ ...organization, organizationType: 'UNIVERSIDADE' }, 'JOB_POST_SLOTS', [], { ...options, employmentType: 'ESTAGIO' }).limit).toBeNull();
    expect(canUseFeature({ ...organization, organizationType: 'CENTRO_FORMACAO' }, 'JOB_POST_SLOTS', [], options).limit).toBe(1);
    expect(canUseFeature({ ...candidate, organizationType: 'UNIVERSIDADE' }, 'JOB_POST_SLOTS', [], { ...options, employmentType: 'ESTAGIO' }).allowed).toBe(false);
    expect(canUseFeature(organization, 'CV_DOCUMENTS', [], options).allowed).toBe(false);
  });
  test.each([{ used: -1 }, { used: NaN }, { requested: 0 }, { requested: 1.5 }, { now: Infinity }])('invalid consumption denied: %j', (changes) => expect(canUseFeature(organization, 'JOB_POST_SLOTS', [], { ...options, ...changes }).allowed).toBe(false));
  test('missing subject, overflow bounded and admin grant', () => {
    expect(canUseFeature({ ...organization, id: '' }, 'JOB_POST_SLOTS', [], options).allowed).toBe(false);
    expect(canUseFeature(organization, 'JOB_POST_SLOTS', [grant({ quantity: Number.MAX_SAFE_INTEGER }), grant({ source: 'ADMIN', quantity: 100 })], options).limit).toBe(Number.MAX_SAFE_INTEGER);
    expect(canUseFeature(candidate, 'CV_ADVANCED', [grant({ subjectType: 'CANDIDATE', subjectId: candidate.id, feature: 'CV_ADVANCED', source: 'PROMO', quantity: 1 })], options).allowed).toBe(true);
    expect(canUseFeature(organization, 'FAKE' as EntitlementKey, [], options).allowed).toBe(false);
  });
});
