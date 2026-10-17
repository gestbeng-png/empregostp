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

export const ReportStatus = Object.freeze({
  OPEN: 'OPEN',
  TRIAGED: 'TRIAGED',
  RESOLVED_ACTION_TAKEN: 'RESOLVED_ACTION_TAKEN',
  RESOLVED_NO_ACTION: 'RESOLVED_NO_ACTION',
  DUPLICATE: 'DUPLICATE',
} as const);
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];
export const REPORT_TRANSITIONS: Readonly<
  Record<ReportStatus, readonly Transition[]>
> = LIFECYCLES.Report;
export function assertTransition(
  from: ReportStatus,
  to: ReportStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Report', from, to, actor, context);
}
