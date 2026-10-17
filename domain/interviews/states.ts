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

export const InterviewStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  RESCHEDULE_REQUESTED: 'RESCHEDULE_REQUESTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const);
export type InterviewStatus =
  (typeof InterviewStatus)[keyof typeof InterviewStatus];
export const INTERVIEW_TRANSITIONS: Readonly<
  Record<InterviewStatus, readonly Transition[]>
> = LIFECYCLES.Interview;
export function assertTransition(
  from: InterviewStatus,
  to: InterviewStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Interview', from, to, actor, context);
}
