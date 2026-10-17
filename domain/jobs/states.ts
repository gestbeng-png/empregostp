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

export const JobStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PUBLISHED: 'PUBLISHED',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
  FILLED: 'FILLED',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const);
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
export const JOB_TRANSITIONS: Readonly<
  Record<JobStatus, readonly Transition[]>
> = LIFECYCLES.Job;
export function assertTransition(
  from: JobStatus,
  to: JobStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Job', from, to, actor, context);
}
