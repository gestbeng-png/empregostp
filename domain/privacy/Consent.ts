// Finalidades de E2/H5 (página única de consentimentos). ANALYTICS é um
// acréscimo para a medição no browser (Firebase Analytics); não está na lista
// da especificação e não substitui nenhuma das cinco.
export const CONSENT_KINDS = [
  'TALENT_POOL',
  'MARKETING_EMAIL',
  'MARKETING_WHATSAPP',
  'AI_PROCESSING',
  'JOB_ALERTS',
  'ANALYTICS',
] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];
export const LEGAL_DOCUMENTS = ['TERMS', 'PRIVACY', 'EMPLOYER_TERMS'] as const;
export interface ConsentRecord {
  userId: string;
  kind: ConsentKind;
  granted: boolean;
  version: string;
  contentSha256: string;
  source: 'SETTINGS' | 'REGISTRATION' | 'TALENT_OPT_IN';
  atMs: number;
}
export interface TermsAcceptance {
  userId: string;
  document: (typeof LEGAL_DOCUMENTS)[number];
  version: string;
  contentSha256: string;
  atMs: number;
}
/** No consent is inferred from a legacy checkbox or missing field. */
export function hasConsent(
  records: readonly ConsentRecord[],
  userId: string,
  kind: ConsentKind,
  version?: string,
): boolean {
  const latest = records
    .filter(
      (record) =>
        record.userId === userId &&
        record.kind === kind &&
        Number.isFinite(record.atMs),
    )
    .sort((a, b) => b.atMs - a.atMs);
  const record = latest[0];
  if (
    !record ||
    !record.granted ||
    (version !== undefined && record.version !== version)
  )
    return false;
  // Equal-time revoke wins deterministically (no input-order opt-in).
  return !latest.some((item) => item.atMs === record.atMs && !item.granted);
}
export function validLegalVersion(
  version: string,
  contentSha256: string,
): boolean {
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(version) &&
    /^[a-f0-9]{64}$/.test(contentSha256)
  );
}
