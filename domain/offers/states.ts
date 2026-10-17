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

export const OfferStatus = Object.freeze({
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  WITHDRAWN: 'WITHDRAWN',
} as const);
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];
export const OFFER_TRANSITIONS: Readonly<
  Record<OfferStatus, readonly Transition[]>
> = LIFECYCLES.Offer;
export function assertTransition(
  from: OfferStatus,
  to: OfferStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Offer', from, to, actor, context);
}
