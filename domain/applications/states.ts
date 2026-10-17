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

export const ApplicationStatus = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  SHORTLISTED: 'SHORTLISTED',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  OFFER_DECLINED: 'OFFER_DECLINED',
} as const);
export type ApplicationStatus =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus];
export const APPLICATION_TRANSITIONS: Readonly<
  Record<ApplicationStatus, readonly Transition[]>
> = LIFECYCLES.Application;
export function assertTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Application', from, to, actor, context);
}
