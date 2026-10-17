/**
 * B4 / F1.5 — prazos e expiração.
 *
 * Fuso: Africa/Sao_Tome (UTC+0, sem horário de verão). "Até 15/11/2026"
 * significa 15/11/2026 23:59:59.999 nesse fuso. Guardar sempre em UTC.
 */
export const STP_TIME_ZONE = 'Africa/Sao_Tome';
const STP_OFFSET_MS = 0;
const DAY_MS = 86_400_000;

export const DEFAULT_EXPIRY_DAYS = 30;
export const MAX_DEADLINE_DAYS = 90;
export const CURATED_EXPIRY_DAYS = 21;
export const EXTENSION_DAYS = 30;
export const FREE_EXTENSIONS = 2;
export const EXPIRY_WARNING_DAYS = [7, 2] as const;

/** "2026-11-15" → 2026-11-15T23:59:59.999Z (fim do dia em STP). */
export function deadlineToUtc(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const utc = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - STP_OFFSET_MS;
  const check = new Date(utc + STP_OFFSET_MS);
  // Recusa datas impossíveis (31/02 passaria para março).
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return new Date(utc);
}

export function computeExpiresAt(input: {
  publishedAt: Date;
  applicationDeadline: Date | null;
  curatedExternal?: boolean;
}): Date {
  const published = input.publishedAt.getTime();
  if (input.applicationDeadline)
    return new Date(
      Math.min(
        input.applicationDeadline.getTime(),
        published + MAX_DEADLINE_DAYS * DAY_MS,
      ),
    );
  const days = input.curatedExternal
    ? CURATED_EXPIRY_DAYS
    : DEFAULT_EXPIRY_DAYS;
  return new Date(published + days * DAY_MS);
}

/** Prorrogar +30 dias: as duas primeiras são grátis, depois consome entitlement. */
export function extensionCost(extensionsUsed: number): 'FREE' | 'ENTITLEMENT' {
  return extensionsUsed < FREE_EXTENSIONS ? 'FREE' : 'ENTITLEMENT';
}

/** Avisos ao empregador a 7 e a 2 dias (D12 `jobExpiryWarnings`). */
export function dueExpiryWarning(expiresAt: Date, now: Date): 7 | 2 | null {
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
  return daysLeft === 7 || daysLeft === 2 ? daysLeft : null;
}

/** E3/F2.2: só PUBLISHED, candidatura interna e antes do prazo e da expiração. */
export function isAcceptingApplications(
  job: {
    status: string;
    applicationMethod: string;
    applicationDeadline: Date | null;
    expiresAt: Date | null;
  },
  now: Date,
): boolean {
  const t = now.getTime();
  return (
    job.status === 'PUBLISHED' &&
    job.applicationMethod === 'INTERNAL' &&
    (!job.applicationDeadline || t < job.applicationDeadline.getTime()) &&
    (!job.expiresAt || t < job.expiresAt.getTime())
  );
}

const MONTHS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];

/** "15 nov. 2026" no fuso de STP (B4; nunca formato americano). */
export function formatStpDate(date: Date): string {
  const local = new Date(date.getTime() + STP_OFFSET_MS);
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}

/** F1.8: "Candidaturas até 15 nov. 2026" + "faltam 3 dias" se < 7. */
export function formatDeadline(
  deadline: Date,
  now: Date,
): { label: string; urgency: string | null } {
  const label = `Candidaturas até ${formatStpDate(deadline)}`;
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft <= 0 || daysLeft >= 7) return { label, urgency: null };
  return {
    label,
    urgency: daysLeft === 1 ? 'falta 1 dia' : `faltam ${daysLeft} dias`,
  };
}
