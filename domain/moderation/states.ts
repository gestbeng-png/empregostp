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

export const ModerationCaseStatus = Object.freeze({
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  DECIDED: 'DECIDED',
  APPEALED: 'APPEALED',
  APPEAL_DECIDED: 'APPEAL_DECIDED',
} as const);
export type ModerationCaseStatus =
  (typeof ModerationCaseStatus)[keyof typeof ModerationCaseStatus];
export const MODERATION_CASE_TRANSITIONS: Readonly<
  Record<ModerationCaseStatus, readonly Transition[]>
> = LIFECYCLES.ModerationCase;
export function assertTransition(
  from: ModerationCaseStatus,
  to: ModerationCaseStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('ModerationCase', from, to, actor, context);
}
