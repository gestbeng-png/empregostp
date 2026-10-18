// Só interruptores de emergência: param efeitos para fora (IA, WhatsApp,
// email de marketing) sem novo deploy. As funcionalidades em si não têm flags.
export const FEATURE_KEYS = [
  'KILL_AI',
  'KILL_WHATSAPP',
  'KILL_OUTBOUND_EMAIL_MARKETING',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type Environment = 'development' | 'staging' | 'production';
export interface FeatureFlag {
  enabled: boolean;
}
export const DEFAULT_FLAGS: Readonly<Record<FeatureKey, FeatureFlag>> =
  Object.freeze(
    Object.fromEntries(
      FEATURE_KEYS.map((key) => [key, Object.freeze({ enabled: false })]),
    ) as Record<FeatureKey, FeatureFlag>,
  );

export function isEnabled(flag: FeatureFlag | undefined): boolean {
  return flag?.enabled === true;
}
