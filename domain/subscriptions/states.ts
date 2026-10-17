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

export const SubscriptionStatus = Object.freeze({
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const);
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const SUBSCRIPTION_TRANSITIONS: Readonly<
  Record<SubscriptionStatus, readonly Transition[]>
> = LIFECYCLES.Subscription;
export function assertTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Subscription', from, to, actor, context);
}
