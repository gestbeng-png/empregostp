import * as applications from '@/domain/applications/states';
import * as hires from '@/domain/hires/states';
import * as interviews from '@/domain/interviews/states';
import * as jobs from '@/domain/jobs/states';
import { actorMatches, assertTransition, assertVersion, LIFECYCLES } from '@/domain/lifecycle/states';
import type { EntityKind, TransitionActor } from '@/domain/lifecycle/states';
import * as moderation from '@/domain/moderation/states';
import * as offers from '@/domain/offers/states';
import * as payments from '@/domain/payments/states';
import * as reports from '@/domain/reports/states';
import * as subscriptions from '@/domain/subscriptions/states';
import * as talentInvites from '@/domain/talent-invites/states';
import * as teamInvitations from '@/domain/team-invitations/states';
import * as verification from '@/domain/verification/states';

const actors: TransitionActor[] = ['CANDIDATE', 'EMPLOYER', 'OWNER', 'ORG_ADMIN', 'RECRUITER', 'ORG_REVIEWER', 'EMPLOYER_ADMIN', 'MODERATOR', 'REVIEWER', 'ADMIN', 'SUPPORT', 'NONE', 'SYSTEM'];
const machines = Object.entries(LIFECYCLES) as [EntityKind, typeof LIFECYCLES.Job][];
describe('Lifecycle policy: all state pairs and actors', () => {
  for (const [kind, machine] of machines) {
    for (const [from, transitions] of Object.entries(machine)) {
      for (const to of Object.keys(machine)) {
        const edges = transitions.filter((edge) => edge.to === to);
        for (const actor of actors) {
          test(`${kind}: ${from} -> ${to} by ${actor}`, () => {
            const allowed = edges.filter((edge) => edge.actors.some((role) => actorMatches(actor, role)));
            const guards = Object.fromEntries(allowed.filter((edge) => edge.guard).map((edge) => [edge.guard, true]));
            const result = assertTransition(kind, from, to, actor, { reason: 'Synthetic correction', guards });
            expect(result.ok).toBe(allowed.length > 0);
            if (!result.ok) expect(result.error.code).toBe(edges.length ? 'TRANSITION_FORBIDDEN' : 'INVALID_TRANSITION');
          });
        }
      }
      for (const edge of transitions) {
        const actor = edge.actors[0] ?? 'NONE';
        if (edge.guard) test(`${kind} ${from}->${edge.to} requires ${edge.guard}`, () => {
          const otherEdges = transitions.filter((other) => other.to === edge.to && other.actors.includes(actor) && !other.guard);
          if (!otherEdges.length) expect(assertTransition(kind, from, edge.to, actor, { reason: 'Synthetic', guards: { [edge.guard ?? '']: false } })).toMatchObject({ ok: false, error: { code: 'TRANSITION_GUARD_FAILED' } });
        });
        if (edge.reasonRequired) test(`${kind} ${from}->${edge.to} needs a nonblank reason`, () => {
          expect(assertTransition(kind, from, edge.to, actor, { reason: '  ', guards: edge.guard ? { [edge.guard]: true } : {} })).toMatchObject({ ok: false, error: { code: 'TRANSITION_GUARD_FAILED' } });
        });
      }
    }
    test(`${kind}: unknown states and frozen policy`, () => {
      expect(assertTransition(kind, '__proto__', 'missing', 'ADMIN').ok).toBe(false);
      expect(Object.isFrozen(machine)).toBe(true);
      Object.values(machine).forEach((edges) => { expect(Object.isFrozen(edges)).toBe(true); edges.forEach((edge) => expect(Object.isFrozen(edge.actors)).toBe(true)); });
    });
  }
  test('Independent business-critical constraints', () => {
    expect(assertTransition('Job', 'DRAFT', 'PUBLISHED', 'OWNER').ok).toBe(false);
    expect(assertTransition('Job', 'DRAFT', 'PUBLISHED', 'OWNER', { guards: { canAutoPublish: true } }).ok).toBe(true);
    expect(assertTransition('Job', 'PUBLISHED', 'EXPIRED', 'OWNER', { guards: { hasExpired: true } }).ok).toBe(false);
    expect(assertTransition('Application', 'REJECTED', 'UNDER_REVIEW', 'RECRUITER', { reason: 'Correction', guards: { withinRejectionCorrectionWindow: true } }).ok).toBe(false);
    expect(assertTransition('Application', 'HIRED', 'WITHDRAWN', 'CANDIDATE').ok).toBe(false);
    expect(assertTransition('Application', 'OFFER', 'HIRED', 'OWNER', { guards: { acceptedOfferAndHireConfirmed: true } }).ok).toBe(false);
    expect(assertTransition('Payment', 'PENDING', 'PAID', 'ADMIN').ok).toBe(false);
    expect(assertTransition('Payment', 'AWAITING_CONFIRMATION', 'PAID', 'ADMIN').ok).toBe(false);
    expect(assertTransition('ModerationCase', 'APPEALED', 'APPEAL_DECIDED', 'MODERATOR', { reason: 'Review', guards: { differentAppealReviewer: false } }).ok).toBe(false);
  });
  test.each([-1, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1])('invalid expected version %s', (version) => expect(assertVersion(version, version).ok).toBe(false));
  test('optimistic concurrency', () => { expect(assertVersion(1, 2).ok).toBe(false); expect(assertVersion(0, 0).ok).toBe(true); });
});

describe('Entity-specific typed enums and transition wrappers', () => {
  test('all entity modules delegate to the same policy', () => {
    const cases = [
      [jobs.JobStatus, jobs.JOB_TRANSITIONS, jobs.assertTransition('PUBLISHED', 'PAUSED', 'OWNER')],
      [applications.ApplicationStatus, applications.APPLICATION_TRANSITIONS, applications.assertTransition('SUBMITTED', 'UNDER_REVIEW', 'SYSTEM')],
      [interviews.InterviewStatus, interviews.INTERVIEW_TRANSITIONS, interviews.assertTransition('SCHEDULED', 'CONFIRMED', 'CANDIDATE')],
      [offers.OfferStatus, offers.OFFER_TRANSITIONS, offers.assertTransition('SENT', 'WITHDRAWN', 'OWNER')],
      [verification.VerificationRequestStatus, verification.VERIFICATION_REQUEST_TRANSITIONS, verification.assertTransition('PENDING', 'IN_REVIEW', 'REVIEWER')],
      [reports.ReportStatus, reports.REPORT_TRANSITIONS, reports.assertTransition('OPEN', 'TRIAGED', 'MODERATOR')],
      [moderation.ModerationCaseStatus, moderation.MODERATION_CASE_TRANSITIONS, moderation.assertTransition('OPEN', 'IN_REVIEW', 'MODERATOR')],
      [payments.PaymentStatus, payments.PAYMENT_TRANSITIONS, payments.assertTransition('PENDING', 'CANCELLED', 'CANDIDATE')],
      [subscriptions.SubscriptionStatus, subscriptions.SUBSCRIPTION_TRANSITIONS, subscriptions.assertTransition('TRIAL', 'ACTIVE', 'SYSTEM', { guards: { paymentPaid: true } })],
      [teamInvitations.TeamInvitationStatus, teamInvitations.TEAM_INVITATION_TRANSITIONS, teamInvitations.assertTransition('PENDING', 'REVOKED', 'OWNER')],
      [hires.HireStatus, hires.HIRE_TRANSITIONS, hires.assertTransition('ACTIVE', 'ANNULLED', 'ADMIN', { reason: 'Correction' })],
      [talentInvites.TalentInviteStatus, talentInvites.TALENT_INVITE_TRANSITIONS, talentInvites.assertTransition('SENT', 'VIEWED', 'CANDIDATE')],
    ] as const;
    cases.forEach(([statuses, transitions, result]) => { expect(Object.isFrozen(statuses)).toBe(true); expect(Object.keys(statuses).sort()).toEqual(Object.keys(transitions).sort()); expect(result.ok).toBe(true); });
  });
});

