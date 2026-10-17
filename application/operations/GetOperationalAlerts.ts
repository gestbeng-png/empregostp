export interface OperationalSnapshot {
  oldestDueAgeMs: number;
  dead: number;
  lastOutboxRunAtMs: number | null;
}
export type OperationalAlert = {
  code: 'OUTBOX_OVERDUE' | 'OUTBOX_DEAD_LETTERS' | 'OUTBOX_CRON_STALE';
  severity: 'warning' | 'critical';
};
export function getOperationalAlerts(
  snapshot: OperationalSnapshot,
  now: number,
  outboxExpected: boolean,
  oldestDueWarningMs = 900_000,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  if (snapshot.oldestDueAgeMs > oldestDueWarningMs)
    alerts.push({ code: 'OUTBOX_OVERDUE', severity: 'warning' });
  if (snapshot.dead > 0)
    alerts.push({ code: 'OUTBOX_DEAD_LETTERS', severity: 'critical' });
  if (
    outboxExpected &&
    (snapshot.lastOutboxRunAtMs === null ||
      now - snapshot.lastOutboxRunAtMs > 7_200_000)
  )
    alerts.push({ code: 'OUTBOX_CRON_STALE', severity: 'critical' });
  return alerts;
}
