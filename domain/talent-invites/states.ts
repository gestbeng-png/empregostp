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

export const TalentInviteStatus = Object.freeze({
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const);
export type TalentInviteStatus =
  (typeof TalentInviteStatus)[keyof typeof TalentInviteStatus];
export const TALENT_INVITE_TRANSITIONS: Readonly<
  Record<TalentInviteStatus, readonly Transition[]>
> = LIFECYCLES.TalentInvite;
export function assertTransition(
  from: TalentInviteStatus,
  to: TalentInviteStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('TalentInvite', from, to, actor, context);
}
