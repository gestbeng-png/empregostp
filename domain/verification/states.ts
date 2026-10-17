import {
  assertTransition as assertLifecycleTransition,
  LIFECYCLES,
} from '../lifecycle/states';
import type {
  Transition,
  TransitionActor,
  TransitionContext,
} from '../lifecycle/states';
import type { Result } from '../shared/Result';

export const VerificationRequestStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  NEEDS_MORE_INFO: 'NEEDS_MORE_INFO',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const);
export type VerificationRequestStatus =
  (typeof VerificationRequestStatus)[keyof typeof VerificationRequestStatus];
export const VERIFICATION_REQUEST_TRANSITIONS: Readonly<
  Record<VerificationRequestStatus, readonly Transition[]>
> = LIFECYCLES.VerificationRequest;
export function assertTransition(
  from: VerificationRequestStatus,
  to: VerificationRequestStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition(
    'VerificationRequest',
    from,
    to,
    actor,
    context,
  );
}
