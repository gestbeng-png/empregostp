export const FEATURE_KEYS = [
  'V2_JOB_LIFECYCLE',
  'V2_APPLICATION_SNAPSHOT',
  'V2_CANDIDATE_TRACKING',
  'V2_EMPLOYER_ATS',
  'V2_SCREENING',
  'V2_INTERVIEWS_OFFERS',
  'V2_MATCHING',
  'V2_TALENT_POOL',
  'V2_INVITE_TO_APPLY',
  'V2_VERIFICATION',
  'V2_MODERATION',
  'V2_NOTIFICATIONS_WHATSAPP',
  'V2_SEARCH',
  'V2_SEO_PAGES',
  'V2_PAYMENTS',
  'V2_CAREER_PLUS',
  'V2_MARKET_INSIGHTS',
  'V2_AI_ASSIST',
  'KILL_AI',
  'KILL_WHATSAPP',
  'KILL_OUTBOUND_EMAIL_MARKETING',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type Environment = 'development' | 'staging' | 'production';
export interface FeatureFlag {
  enabled: boolean;
  rolloutPercent?: number;
  allowOrgIds?: readonly string[];
  allowUserIds?: readonly string[];
  environments?: readonly Environment[];
}
export interface FeatureContext {
  environment: Environment;
  organizationId?: string;
  userId?: string;
}
export const DEFAULT_FLAGS: Readonly<Record<FeatureKey, FeatureFlag>> =
  Object.freeze(
    Object.fromEntries(
      FEATURE_KEYS.map((key) => [key, Object.freeze({ enabled: false })]),
    ) as Record<FeatureKey, FeatureFlag>,
  );

function bucket(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) % 10000;
}
export function isEnabled(
  key: FeatureKey,
  flag: FeatureFlag | undefined,
  ctx: FeatureContext,
): boolean {
  if (!flag?.enabled) return false;
  // Emergency switches cannot be bypassed by rollout/allowlists.
  if (key.startsWith('KILL_')) return true;
  if (flag.environments?.length && !flag.environments.includes(ctx.environment))
    return false;
  if (ctx.userId && flag.allowUserIds?.includes(ctx.userId)) return true;
  if (ctx.organizationId && flag.allowOrgIds?.includes(ctx.organizationId))
    return true;
  const percent = flag.rolloutPercent ?? 100;
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return false;
  if (percent === 100) return true;
  const identity = ctx.organizationId || ctx.userId;
  return Boolean(identity && bucket(`${key}:${identity}`) < percent * 100);
}
