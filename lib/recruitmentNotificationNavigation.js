import { isRecruitmentWorkspaceEnabled } from './recruitmentAvailability';

// ADR-019: com «Recrutamento e equipa» retirado, os avisos que apontem para
// lá deixam de navegar.
const paths = new Set([
  '/dashboard/candidato/candidaturas',
  ...(isRecruitmentWorkspaceEnabled() ? ['/dashboard/recrutamento'] : []),
]);

// Never use arbitrary notification URLs as navigation targets.
export function recruitmentNotificationPath(notification) {
  return paths.has(notification?.actionUrl) ? notification.actionUrl : null;
}
