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

export const PaymentStatus = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const);
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PAYMENT_TRANSITIONS: Readonly<
  Record<PaymentStatus, readonly Transition[]>
> = LIFECYCLES.Payment;
export function assertTransition(
  from: PaymentStatus,
  to: PaymentStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('Payment', from, to, actor, context);
}
