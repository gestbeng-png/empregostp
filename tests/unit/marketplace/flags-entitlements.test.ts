import { canUseFeature } from '@/domain/entitlements/canUseFeature';
import type {
  EntitlementGrant,
  EntitlementKey,
} from '@/domain/entitlements/canUseFeature';
import {
  DEFAULT_FLAGS,
  FEATURE_KEYS,
  isEnabled,
} from '@/domain/feature-flags/flags';

const organization = { type: 'ORGANIZATION' as const, id: 'org-a' };
const candidate = { type: 'CANDIDATE' as const, id: 'user-a' };
const now = 100_000;
const options = { now };
const grant = (changes: Partial<EntitlementGrant> = {}): EntitlementGrant => ({
  subjectType: 'ORGANIZATION',
  subjectId: 'org-a',
  feature: 'JOB_POST_SLOTS',
  quantity: 5,
  source: 'PLAN',
  validFrom: 0,
  ...changes,
});

describe('Interruptores de emergência', () => {
  test.each(FEATURE_KEYS)('%s começa desligado', (key) => {
    expect(isEnabled(DEFAULT_FLAGS[key])).toBe(false);
    expect(Object.isFrozen(DEFAULT_FLAGS[key])).toBe(true);
  });
});

describe('Entitlements: default free, settlement, audience and quotas', () => {
  test('free quotas and plan replacing free, topups stacking, unlimited', () => {
    expect(canUseFeature(organization, 'JOB_POST_SLOTS', [], options)).toEqual({
      allowed: true,
      limit: 1,
    });
    expect(canUseFeature(candidate, 'CV_DOCUMENTS', [], options)).toEqual({
      allowed: true,
      limit: 2,
    });
    expect(
      canUseFeature(
        organization,
        'JOB_POST_SLOTS',
        [grant(), grant()],
        options,
      ),
    ).toEqual({ allowed: true, limit: 5 });
    expect(
      canUseFeature(
        organization,
        'JOB_POST_SLOTS',
        [
          grant(),
          grant({ source: 'PURCHASE', paymentStatus: 'PAID', quantity: 2 }),
        ],
        options,
      ).limit,
    ).toBe(7);
    expect(
      canUseFeature(
        organization,
        'JOB_POST_SLOTS',
        [grant({ quantity: null })],
        { ...options, used: 999 },
      ),
    ).toEqual({ allowed: true, limit: null });
    expect(canUseFeature(organization, 'TALENT_SEARCH', [], options).code).toBe(
      'ENTITLEMENT_REQUIRED',
    );
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', [], { ...options, used: 1 })
        .code,
    ).toBe('LIMIT_REACHED');
  });
  test.each([
    { subjectId: 'org-b' },
    { subjectType: 'CANDIDATE' as const },
    { feature: 'EXPORT' as const },
    { revoked: true },
    { validFrom: now + 1 },
    { validFrom: NaN },
    { validUntil: now },
    { validUntil: NaN },
    { source: 'PURCHASE' as const },
    { quantity: -1 },
    { quantity: 1.5 },
    { quantity: Number.MAX_SAFE_INTEGER + 1 },
  ])('invalid/expired/wrong grant ignored: %j', (changes) =>
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', [grant(changes)], options)
        .limit,
    ).toBe(1),
  );
  test('education exception only organization internships', () => {
    expect(
      canUseFeature(
        { ...organization, organizationType: 'UNIVERSIDADE' },
        'JOB_POST_SLOTS',
        [],
        { ...options, employmentType: 'ESTAGIO' },
      ).limit,
    ).toBeNull();
    expect(
      canUseFeature(
        { ...organization, organizationType: 'CENTRO_FORMACAO' },
        'JOB_POST_SLOTS',
        [],
        options,
      ).limit,
    ).toBe(1);
    expect(
      canUseFeature(
        { ...candidate, organizationType: 'UNIVERSIDADE' },
        'JOB_POST_SLOTS',
        [],
        { ...options, employmentType: 'ESTAGIO' },
      ).allowed,
    ).toBe(false);
    expect(
      canUseFeature(organization, 'CV_DOCUMENTS', [], options).allowed,
    ).toBe(false);
  });
  test.each([
    { used: -1 },
    { used: NaN },
    { requested: 0 },
    { requested: 1.5 },
    { now: Infinity },
  ])('invalid consumption denied: %j', (changes) =>
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', [], {
        ...options,
        ...changes,
      }).allowed,
    ).toBe(false),
  );
  test('missing subject, overflow bounded and admin grant', () => {
    expect(
      canUseFeature({ ...organization, id: '' }, 'JOB_POST_SLOTS', [], options)
        .allowed,
    ).toBe(false);
    expect(
      canUseFeature(
        organization,
        'JOB_POST_SLOTS',
        [
          grant({ quantity: Number.MAX_SAFE_INTEGER }),
          grant({ source: 'ADMIN', quantity: 100 }),
        ],
        options,
      ).limit,
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      canUseFeature(
        candidate,
        'CV_ADVANCED',
        [
          grant({
            subjectType: 'CANDIDATE',
            subjectId: candidate.id,
            feature: 'CV_ADVANCED',
            source: 'PROMO',
            quantity: 1,
          }),
        ],
        options,
      ).allowed,
    ).toBe(true);
    expect(
      canUseFeature(organization, 'FAKE' as EntitlementKey, [], options)
        .allowed,
    ).toBe(false);
  });
});
