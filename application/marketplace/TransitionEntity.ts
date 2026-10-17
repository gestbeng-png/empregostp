import type { FeatureContext, FeatureKey } from '@/domain/feature-flags/flags';
import type { EntityKind } from '@/domain/lifecycle/states';
import { failure } from '@/domain/shared/Result';
import type { Result } from '@/domain/shared/Result';

import type {
  FeatureFlagReader,
  LifecycleStore,
  TransitionCommand,
  TransitionPolicy,
  TransitionReceipt,
} from './ports';

export const LIFECYCLE_FLAGS: Readonly<Record<EntityKind, FeatureKey>> =
  Object.freeze({
    Job: 'V2_JOB_LIFECYCLE',
    Application: 'V2_EMPLOYER_ATS',
    Interview: 'V2_INTERVIEWS_OFFERS',
    Offer: 'V2_INTERVIEWS_OFFERS',
    VerificationRequest: 'V2_VERIFICATION',
    Report: 'V2_MODERATION',
    ModerationCase: 'V2_MODERATION',
    Payment: 'V2_PAYMENTS',
    Subscription: 'V2_PAYMENTS',
    TeamInvitation: 'V2_EMPLOYER_ATS',
    Hire: 'V2_EMPLOYER_ATS',
    TalentInvite: 'V2_INVITE_TO_APPLY',
  });

/** No public route calls this foundation yet. A future use case must provide
 * its own server-side, pure facts/authorization policy, not browser guards. */
export class TransitionEntity {
  constructor(
    private readonly flags: FeatureFlagReader,
    private readonly store: LifecycleStore,
    private readonly policy: TransitionPolicy,
  ) {}

  async execute(
    command: TransitionCommand,
    context: FeatureContext,
  ): Promise<Result<TransitionReceipt>> {
    const flag = LIFECYCLE_FLAGS[command.kind];
    if (
      !flag ||
      !(await this.flags.enabled(flag, {
        ...context,
        userId: command.actorUserId,
      }))
    )
      return failure('FEATURE_DISABLED');
    return this.store.transition(command, this.policy);
  }
}
