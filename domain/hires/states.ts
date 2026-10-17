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

export const HireStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  ANNULLED: 'ANNULLED',
} as const);
export type HireStatus = (typeof HireStatus)[keyof typeof HireStatus];
export const HIRE_TRANSITIONS: Readonly<
  Record<HireStatus, readonly Transition[]>
> = LIFECYCLES.Hire;
export function assertTransition(
  from: HireStatus,
  to: HireStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Hire', from, to, actor, context);
}
