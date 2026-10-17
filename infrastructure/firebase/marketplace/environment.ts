import type { Environment } from '@/domain/feature-flags/flags';

export function getFeatureEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Environment {
  if (env.VERCEL_ENV === 'production') return 'production';
  if (env.VERCEL_ENV === 'preview') return 'staging';
  return env.NODE_ENV === 'production' ? 'production' : 'development';
}
