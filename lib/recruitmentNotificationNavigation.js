const paths = new Set([
  '/dashboard/candidato/candidaturas',
  '/dashboard/recrutamento',
]);

// Never use arbitrary notification URLs as navigation targets.
export function recruitmentNotificationPath(notification) {
  return paths.has(notification?.actionUrl) ? notification.actionUrl : null;
}
