import type {
  LifecycleRecord,
  ResolvedIdentity,
  TransitionPolicy,
} from '@/application/marketplace/ports';
import { can } from '@/domain/permissions/can';
import { failure, success } from '@/domain/shared/Result';

const DAY_MS = 86_400_000;
export const REJECTION_CORRECTION_DAYS = 14;

function millis(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in value)
    return (value as { toMillis: () => number }).toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * E4/H3 — mudança de estado de candidatura pela organização (ATS v2).
 * Puro e sem efeitos (a transação pode repeti-lo). Contratação e proposta
 * têm fluxos próprios (E5/E7): aqui os guardas `hireConfirmed` e `offerSent`
 * ficam falsos, por isso essas transições são recusadas nesta rota.
 */
export function createApplicationTransitionPolicy(
  to: string,
  now: () => number = Date.now,
): TransitionPolicy {
  return async (record: LifecycleRecord, identity: ResolvedIdentity) => {
    const actor = identity.permission;
    const resource = {
      organizationId: record.organizationId,
      jobId: record.jobId,
      candidateUserId: record.candidateUserId,
      requestedStatus: to,
    };
    const reversing = record.v2Status === 'REJECTED' && to === 'UNDER_REVIEW';
    if (
      !can(
        actor,
        reversing ? 'reverse_rejection' : 'change_application_status',
        resource,
      )
    )
      return failure('FORBIDDEN');
    const changedAt = millis(record.facts.lastStatusChangeAt);
    return success({
      guards: {
        hireConfirmed: false,
        offerSent: false,
        withinRejectionCorrectionWindow:
          reversing &&
          changedAt !== null &&
          now() - changedAt <= REJECTION_CORRECTION_DAYS * DAY_MS,
      },
    });
  };
}
