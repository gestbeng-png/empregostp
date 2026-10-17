export const ENTITLEMENT_KEYS = [
  'JOB_POST_SLOTS',
  'ATS_PIPELINE',
  'ATS_BULK_ACTIONS',
  'SCREENING_QUESTIONS',
  'MATCH_SCORES',
  'TALENT_SEARCH',
  'INVITES_MONTHLY',
  'FEATURED_JOB',
  'ANALYTICS_ADVANCED',
  'EMPLOYER_BRANDING',
  'SEATS',
  'ROLES_PERMISSIONS',
  'EXPORT',
  'REPORTS',
  'CV_DOCUMENTS',
  'CV_ADVANCED',
  'COVER_LETTER_AI',
] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];
export interface Subject {
  type: 'ORGANIZATION' | 'CANDIDATE';
  id: string;
  organizationType?: string;
}
export interface EntitlementGrant {
  subjectType: Subject['type'];
  subjectId: string;
  feature: EntitlementKey;
  quantity: number | null;
  validFrom: number;
  validUntil?: number;
  source: 'PLAN' | 'PURCHASE' | 'PROMO' | 'ADMIN';
  paymentStatus?: 'PAID';
  revoked?: boolean;
}
export interface FeatureDecision {
  allowed: boolean;
  limit: number | null;
  code?: 'FEATURE_DISABLED' | 'ENTITLEMENT_REQUIRED' | 'LIMIT_REACHED';
}
const freeOrganization: Partial<Record<EntitlementKey, number>> = {
  JOB_POST_SLOTS: 1,
  ATS_PIPELINE: 1,
  ATS_BULK_ACTIONS: 20,
  SCREENING_QUESTIONS: 3,
  MATCH_SCORES: 1,
  SEATS: 2,
};
const freeCandidate: Partial<Record<EntitlementKey, number>> = {
  CV_DOCUMENTS: 2,
  COVER_LETTER_AI: 2,
};

export function canUseFeature(
  subject: Subject,
  feature: EntitlementKey,
  grants: readonly EntitlementGrant[],
  options: {
    now: number;
    used?: number;
    requested?: number;
    v2Enabled: boolean;
    legacyDecision?: FeatureDecision;
    employmentType?: string;
  },
): FeatureDecision {
  if (!options.v2Enabled)
    return (
      options.legacyDecision || {
        allowed: false,
        limit: 0,
        code: 'FEATURE_DISABLED',
      }
    );
  const used = options.used ?? 0;
  const requested = options.requested ?? 1;
  if (
    !subject.id ||
    !Number.isSafeInteger(used) ||
    used < 0 ||
    !Number.isSafeInteger(requested) ||
    requested < 1 ||
    !Number.isFinite(options.now)
  )
    return { allowed: false, limit: 0, code: 'LIMIT_REACHED' };
  const candidateFeature = [
    'CV_DOCUMENTS',
    'CV_ADVANCED',
    'COVER_LETTER_AI',
  ].includes(feature);
  if ((subject.type === 'CANDIDATE') !== candidateFeature)
    return { allowed: false, limit: 0, code: 'ENTITLEMENT_REQUIRED' };
  if (
    subject.type === 'ORGANIZATION' &&
    feature === 'JOB_POST_SLOTS' &&
    ['UNIVERSIDADE', 'CENTRO_FORMACAO'].includes(
      subject.organizationType || '',
    ) &&
    options.employmentType === 'ESTAGIO'
  )
    return { allowed: true, limit: null };
  const valid = grants.filter(
    (grant) =>
      grant.subjectId === subject.id &&
      grant.subjectType === subject.type &&
      grant.feature === feature &&
      !grant.revoked &&
      Number.isFinite(grant.validFrom) &&
      grant.validFrom <= options.now &&
      (grant.validUntil === undefined ||
        (Number.isFinite(grant.validUntil) &&
          grant.validUntil > options.now)) &&
      (grant.source !== 'PURCHASE' || grant.paymentStatus === 'PAID') &&
      (grant.quantity === null ||
        (Number.isSafeInteger(grant.quantity) && grant.quantity > 0)),
  );
  // Plans replace the free baseline; top-ups stack, duplicate plan records do
  // not double the quota. Purchases must already have settled.
  // PROMO counts as a plan (G3 Programa Fundador = Recruit Pro granted as
  // PROMO): a founder organization gets 5 job slots, not free 1 + 5.
  const isPlanLike = (grant: EntitlementGrant): boolean =>
    grant.source === 'PLAN' || grant.source === 'PROMO';
  const plans = valid.filter(isPlanLike);
  let limit: number | null = plans.length
    ? Math.max(...plans.map((grant) => grant.quantity ?? 0))
    : (subject.type === 'ORGANIZATION' ? freeOrganization : freeCandidate)[
        feature
      ] || 0;
  if (valid.some((grant) => grant.quantity === null)) limit = null;
  else
    for (const grant of valid.filter((item) => !isPlanLike(item)))
      limit = Math.min(
        Number.MAX_SAFE_INTEGER,
        (limit ?? 0) + (grant.quantity ?? 0),
      );
  if (limit === 0)
    return { allowed: false, limit, code: 'ENTITLEMENT_REQUIRED' };
  return limit === null || requested <= limit - used
    ? { allowed: true, limit }
    : { allowed: false, limit, code: 'LIMIT_REACHED' };
}
