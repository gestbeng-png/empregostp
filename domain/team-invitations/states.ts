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

export const TeamInvitationStatus = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const);
export type TeamInvitationStatus =
  (typeof TeamInvitationStatus)[keyof typeof TeamInvitationStatus];
export const TEAM_INVITATION_TRANSITIONS: Readonly<
  Record<TeamInvitationStatus, readonly Transition[]>
> = LIFECYCLES.TeamInvitation;
export function assertTransition(
  from: TeamInvitationStatus,
  to: TeamInvitationStatus,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  return assertLifecycleTransition('TeamInvitation', from, to, actor, context);
}
