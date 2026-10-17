import { failure, success } from '../shared/Result';
import type { Result } from '../shared/Result';

export type TransitionActor =
  | 'CANDIDATE'
  | 'EMPLOYER'
  | 'OWNER'
  | 'ORG_ADMIN'
  | 'RECRUITER'
  | 'ORG_REVIEWER'
  | 'EMPLOYER_ADMIN'
  | 'MODERATOR'
  | 'REVIEWER'
  | 'ADMIN'
  | 'SUPPORT'
  | 'NONE'
  | 'SYSTEM';
export interface Transition {
  to: string;
  actors: readonly TransitionActor[];
  guard?: string;
  reasonRequired?: boolean;
}
export type StateMachine = Readonly<Record<string, readonly Transition[]>>;
const t = (
  to: string,
  actors: readonly TransitionActor[],
  guard?: string,
  reasonRequired = false,
): Transition => ({ to, actors, guard, reasonRequired });
const employer: readonly TransitionActor[] = ['EMPLOYER'];
const moderator: readonly TransitionActor[] = ['MODERATOR', 'ADMIN'];
const recruiter: readonly TransitionActor[] = ['EMPLOYER'];

export const LIFECYCLES = {
  Job: {
    DRAFT: [
      t('PUBLISHED', employer, 'canAutoPublish'),
      t('PENDING_REVIEW', ['EMPLOYER', 'SYSTEM'], 'canSubmit'),
    ],
    PENDING_REVIEW: [
      t('PUBLISHED', moderator, 'canApprove'),
      t('DRAFT', moderator, undefined, true),
      t('REJECTED', moderator, undefined, true),
    ],
    REJECTED: [
      t('DRAFT', employer, 'fixableRejection'),
      t('ARCHIVED', ['EMPLOYER', 'SYSTEM'], 'canArchive'),
    ],
    PUBLISHED: [
      t('PAUSED', employer),
      t('CLOSED', employer, 'hasCloseOutcome'),
      t('FILLED', ['EMPLOYER', 'SYSTEM'], 'allPositionsFilled'),
      t('EXPIRED', ['SYSTEM'], 'hasExpired'),
      t('PENDING_REVIEW', moderator, undefined, true),
      t('PENDING_REVIEW', ['SYSTEM'], 'requiresReview'),
    ],
    PAUSED: [
      t('PUBLISHED', employer, 'deadlineFuture'),
      t('CLOSED', employer, 'hasCloseOutcome'),
      t('FILLED', ['EMPLOYER', 'SYSTEM'], 'allPositionsFilled'),
      t('PENDING_REVIEW', moderator, undefined, true),
      t('PENDING_REVIEW', ['SYSTEM'], 'requiresReview'),
    ],
    EXPIRED: [
      t('PUBLISHED', employer, 'canRenew'),
      t('CLOSED', employer, 'hasCloseOutcome'),
      t('ARCHIVED', ['EMPLOYER', 'SYSTEM'], 'canArchive'),
    ],
    CLOSED: [t('ARCHIVED', ['EMPLOYER', 'SYSTEM'], 'canArchive')],
    FILLED: [t('ARCHIVED', ['EMPLOYER', 'SYSTEM'], 'canArchive')],
    ARCHIVED: [],
  },
  Application: {
    DRAFT: [t('SUBMITTED', ['CANDIDATE'], 'canSubmitApplication')],
    SUBMITTED: [
      t('UNDER_REVIEW', ['EMPLOYER', 'SYSTEM']),
      t('SHORTLISTED', recruiter),
    ],
    UNDER_REVIEW: [t('SHORTLISTED', recruiter), t('INTERVIEW', recruiter)],
    SHORTLISTED: [
      t('INTERVIEW', recruiter),
      t('OFFER', recruiter, 'offerSent'),
      t('HIRED', recruiter, 'hireConfirmed'),
    ],
    INTERVIEW: [
      t('OFFER', recruiter, 'offerSent'),
      t('SHORTLISTED', recruiter, undefined, true),
      t('UNDER_REVIEW', recruiter, undefined, true),
      t('HIRED', recruiter, 'hireConfirmed'),
    ],
    OFFER: [
      t('HIRED', ['SYSTEM'], 'acceptedOfferAndHireConfirmed'),
      t('OFFER_DECLINED', ['SYSTEM'], 'offerDeclinedOrExpired'),
    ],
    OFFER_DECLINED: [t('SHORTLISTED', recruiter)],
    REJECTED: [
      t(
        'UNDER_REVIEW',
        ['EMPLOYER_ADMIN', 'ADMIN'],
        'withinRejectionCorrectionWindow',
        true,
      ),
    ],
    HIRED: [t('REJECTED', ['ADMIN'], 'hireAnnulled', true)],
    WITHDRAWN: [],
  },
  Interview: {
    SCHEDULED: [
      t('CONFIRMED', ['CANDIDATE']),
      t('RESCHEDULE_REQUESTED', ['CANDIDATE'], 'hasRescheduleProposal'),
      t('CANCELLED', ['CANDIDATE', 'EMPLOYER'], undefined, true),
      t('COMPLETED', recruiter, 'interviewStarted'),
      t('NO_SHOW', recruiter, 'interviewStarted'),
    ],
    CONFIRMED: [
      t('RESCHEDULE_REQUESTED', ['CANDIDATE'], 'hasRescheduleProposal'),
      t('CANCELLED', ['CANDIDATE', 'EMPLOYER'], undefined, true),
      t('COMPLETED', recruiter, 'interviewStarted'),
      t('NO_SHOW', recruiter, 'interviewStarted'),
    ],
    RESCHEDULE_REQUESTED: [t('SCHEDULED', recruiter, 'hasNewInterviewTime')],
    CANCELLED: [],
    COMPLETED: [],
    NO_SHOW: [],
  },
  Offer: {
    DRAFT: [t('SENT', recruiter, 'canSendOffer')],
    SENT: [
      t('ACCEPTED', ['CANDIDATE'], 'offerUnexpired'),
      t('DECLINED', ['CANDIDATE'], 'offerUnexpired'),
      t('EXPIRED', ['SYSTEM'], 'hasExpired'),
      t('WITHDRAWN', recruiter),
    ],
    ACCEPTED: [],
    DECLINED: [],
    EXPIRED: [],
    WITHDRAWN: [],
  },
  VerificationRequest: {
    DRAFT: [t('PENDING', ['CANDIDATE', 'EMPLOYER'], 'hasRequiredDocuments')],
    PENDING: [t('IN_REVIEW', ['REVIEWER', 'ADMIN'])],
    IN_REVIEW: [
      t('APPROVED', ['REVIEWER', 'ADMIN'], 'canApprove'),
      t('REJECTED', ['REVIEWER', 'ADMIN'], undefined, true),
      t('NEEDS_MORE_INFO', ['REVIEWER', 'ADMIN'], undefined, true),
    ],
    NEEDS_MORE_INFO: [
      t('PENDING', ['CANDIDATE', 'EMPLOYER'], 'hasRequiredDocuments'),
    ],
    APPROVED: [
      t('EXPIRED', ['SYSTEM'], 'hasExpired'),
      t('REVOKED', ['ADMIN'], undefined, true),
    ],
    REJECTED: [],
    EXPIRED: [],
    REVOKED: [],
  },
  Report: {
    OPEN: [t('TRIAGED', moderator)],
    TRIAGED: [
      t('RESOLVED_ACTION_TAKEN', moderator, 'caseDecided'),
      t('RESOLVED_NO_ACTION', moderator, 'caseDecided'),
      t('DUPLICATE', moderator, 'hasOriginalReport'),
    ],
    RESOLVED_ACTION_TAKEN: [],
    RESOLVED_NO_ACTION: [],
    DUPLICATE: [],
  },
  ModerationCase: {
    OPEN: [t('IN_REVIEW', moderator)],
    IN_REVIEW: [t('DECIDED', moderator, 'hasDecision', true)],
    DECIDED: [t('APPEALED', ['CANDIDATE', 'EMPLOYER'], 'canAppeal')],
    APPEALED: [t('APPEAL_DECIDED', moderator, 'differentAppealReviewer', true)],
    APPEAL_DECIDED: [],
  },
  Payment: {
    PENDING: [
      t('PROCESSING', ['SYSTEM'], 'providerVerified'),
      t('AWAITING_CONFIRMATION', ['CANDIDATE', 'EMPLOYER'], 'hasPaymentProof'),
      t('CANCELLED', ['CANDIDATE', 'EMPLOYER', 'SYSTEM']),
    ],
    PROCESSING: [
      t('PAID', ['SYSTEM'], 'providerVerified'),
      t('FAILED', ['SYSTEM'], 'providerVerified'),
    ],
    AWAITING_CONFIRMATION: [
      t('PAID', ['ADMIN'], 'proofConfirmed'),
      t('FAILED', ['ADMIN'], undefined, true),
    ],
    PAID: [t('REFUNDED', ['ADMIN'], 'canRefund', true)],
    FAILED: [],
    CANCELLED: [],
    REFUNDED: [],
  },
  Subscription: {
    TRIAL: [t('ACTIVE', ['SYSTEM'], 'paymentPaid')],
    ACTIVE: [
      t('PAST_DUE', ['SYSTEM'], 'renewalFailed'),
      t('CANCELLED', ['CANDIDATE', 'EMPLOYER'], 'cancelAtPeriodEnd'),
    ],
    PAST_DUE: [
      t('ACTIVE', ['SYSTEM'], 'paymentPaid'),
      t('EXPIRED', ['SYSTEM'], 'graceExpired'),
    ],
    CANCELLED: [t('EXPIRED', ['SYSTEM'], 'periodEnded')],
    EXPIRED: [],
  },
  TeamInvitation: {
    PENDING: [
      t(
        'ACCEPTED',
        ['EMPLOYER', 'CANDIDATE'],
        'verifiedEmailMatchesInvitation',
      ),
      t('EXPIRED', ['SYSTEM'], 'hasExpired'),
      t('REVOKED', ['EMPLOYER_ADMIN']),
    ],
    ACCEPTED: [],
    EXPIRED: [],
    REVOKED: [],
  },
  Hire: { ACTIVE: [t('ANNULLED', ['ADMIN'], undefined, true)], ANNULLED: [] },
  TalentInvite: {
    SENT: [
      t('VIEWED', ['CANDIDATE']),
      t('ACCEPTED', ['CANDIDATE'], 'inviteUnexpired'),
      t('DECLINED', ['CANDIDATE'], 'inviteUnexpired'),
      t('EXPIRED', ['SYSTEM'], 'hasExpired'),
    ],
    VIEWED: [
      t('ACCEPTED', ['CANDIDATE'], 'inviteUnexpired'),
      t('DECLINED', ['CANDIDATE'], 'inviteUnexpired'),
      t('EXPIRED', ['SYSTEM'], 'hasExpired'),
    ],
    ACCEPTED: [],
    DECLINED: [],
    EXPIRED: [],
  },
} satisfies Record<string, StateMachine>;

// Non-terminal applications may be withdrawn or rejected; OFFER_DECLINED is
// recoverable. Terminal records cannot be silently re-opened.
const applicationNonTerminal = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
  'OFFER_DECLINED',
] as const;
for (const state of applicationNonTerminal) {
  LIFECYCLES.Application[state].push(
    t('WITHDRAWN', ['CANDIDATE']),
    t('REJECTED', ['EMPLOYER', 'SYSTEM'], 'hasClosedReason'),
  );
}
// Freeze deeply: a consumer must not be able to weaken the policy at runtime.
for (const machine of Object.values(LIFECYCLES)) {
  for (const transitions of Object.values(machine)) {
    for (const transition of transitions) {
      Object.freeze(transition.actors);
      Object.freeze(transition);
    }
    Object.freeze(transitions);
  }
  Object.freeze(machine);
}
Object.freeze(LIFECYCLES);
export type EntityKind = keyof typeof LIFECYCLES;
export interface TransitionContext {
  reason?: string;
  guards?: Readonly<Record<string, boolean>>;
}
export function actorMatches(
  actual: TransitionActor,
  allowed: TransitionActor,
): boolean {
  return (
    actual === allowed ||
    (allowed === 'EMPLOYER' &&
      ['OWNER', 'ORG_ADMIN', 'RECRUITER'].includes(actual)) ||
    (allowed === 'EMPLOYER_ADMIN' && ['OWNER', 'ORG_ADMIN'].includes(actual))
  );
}
export function assertTransition(
  kind: EntityKind,
  from: string,
  to: string,
  actor: TransitionActor,
  context: TransitionContext = {},
): Result<void> {
  const machine: StateMachine = LIFECYCLES[kind];
  if (!machine || !Object.hasOwn(machine, from) || !Object.hasOwn(machine, to))
    return failure('INVALID_TRANSITION');
  const candidates =
    machine[from]?.filter((transition) => transition.to === to) || [];
  if (!candidates.length) return failure('INVALID_TRANSITION');
  const authorized = candidates.filter((transition) =>
    transition.actors.some((allowed) => actorMatches(actor, allowed)),
  );
  if (!authorized.length) return failure('TRANSITION_FORBIDDEN');
  if (
    !authorized.some(
      (transition) =>
        (!transition.guard || context.guards?.[transition.guard] === true) &&
        (!transition.reasonRequired || Boolean(context.reason?.trim())),
    )
  )
    return failure('TRANSITION_GUARD_FAILED');
  return success(undefined);
}

export function assertVersion(expected: number, actual: number): Result<void> {
  return Number.isSafeInteger(expected) && expected >= 0 && expected === actual
    ? success(undefined)
    : failure('VERSION_CONFLICT');
}
