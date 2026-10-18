import { can, PERMISSION_MATRIX, PERMISSION_ROLES } from '@/domain/permissions/can';
import type { PermissionAction, PermissionActor, PermissionResource } from '@/domain/permissions/can';

// Independent H3 fixture: y=yes, p=own, o=organization, a=assigned,
// m=audited motive, -=denied. SUPPORT and anonymous have no private access.
const expected: Record<PermissionAction, string> = {
  view_published_job: 'yyyyyyyyyy', create_job: '-ooo---m--', publish_close_job: '-ooo---m--', moderate_job: '-----y-y--', apply: 'p---------', view_application: 'pooaom-m--', download_application_cv: 'poooom-m--', change_application_status: 'pooo---m--', reverse_rejection: '-oo----m--', internal_notes: '-oooom-m--', interview_offer: '-ooo------', confirm_hire: '-ooo---m--', talent_search: '-ooo---m--', talent_invite: '-ooo------', export_applications: '-oo----m--', manage_members: '-oo----m--', transfer_ownership: '-o-----m--', billing: '-oo----y--', view_verification_documents: 'poo---ym--', decide_verification: '------yy--', report: 'yyyyy-----', decide_report_suspend: '-----y-y--', merge_organizations: '-------y--', view_audit: '-oo----y--', export_personal_data: 'p---------', delete_account: 'ppppp--m--',
};
const labels = { y: 'yes', p: 'own', o: 'org', a: 'assigned', m: 'reason', '-': 'none' } as const;
const resource: PermissionResource = { ownerUserId: 'synthetic-user', candidateUserId: 'synthetic-user', organizationId: 'org-a', jobId: 'job-a', published: true, requestedStatus: 'WITHDRAWN', requestedMemberRole: 'RECRUITER' };
const actor = (role: PermissionActor['role']): PermissionActor => ({ userId: 'synthetic-user', active: true, role, organizationId: 'org-a', membershipActive: true, assignedJobIds: ['job-a'], entitlements: ['TALENT_SEARCH', 'INVITES_MONTHLY', 'EXPORT'], organizationContactVerified: true, reason: 'Synthetic audited access' });

describe('Full H3 matrix (26 actions × 10 roles)', () => {
  expect(Object.keys(expected).sort()).toEqual(Object.keys(PERMISSION_MATRIX).sort());
  for (const [action, row] of Object.entries(expected) as [PermissionAction, string][]) {
    PERMISSION_ROLES.forEach((role, index) => {
      test(`${action} / ${role}`, () => {
        const rule = row[index] as keyof typeof labels;
        expect(PERMISSION_MATRIX[action][index]).toBe(labels[rule]);
        expect(can(actor(role), action, resource)).toBe(rule !== '-');
      });
    });
  }
});
describe('IDOR, account status and exceptional scopes', () => {
  for (const [action, row] of Object.entries(expected) as [PermissionAction, string][]) {
    PERMISSION_ROLES.forEach((role, index) => {
      if (['o', 'a'].includes(row[index] || '')) {
        test(`${action}/${role}: other organization and revoked membership denied`, () => {
          expect(can(actor(role), action, { ...resource, organizationId: 'org-b' })).toBe(false);
          expect(can({ ...actor(role), membershipActive: false }, action, resource)).toBe(false);
        });
      }
      if (row[index] === 'p') test(`${action}/${role}: other owner denied`, () => expect(can(actor(role), action, { ...resource, ownerUserId: 'other', candidateUserId: 'other' })).toBe(false));
      if (row[index] === 'm') test(`${action}/${role}: reason mandatory`, () => expect(can({ ...actor(role), reason: '  ' }, action, resource)).toBe(false));
      if (action !== 'view_published_job') test(`${action}/${role}: inactive or missing identity denied`, () => {
        expect(can({ ...actor(role), active: false }, action, resource)).toBe(false);
        expect(can({ ...actor(role), userId: undefined }, action, resource)).toBe(false);
      });
    });
  }
  test('recruiter assignment and explicit all-jobs option', () => {
    expect(can({ ...actor('RECRUITER'), assignedJobIds: [] }, 'view_application', resource)).toBe(false);
    expect(can({ ...actor('RECRUITER'), assignedJobIds: [], recruiterCanViewAllJobs: true }, 'view_application', resource)).toBe(true);
    expect(can(actor('RECRUITER'), 'view_application', { ...resource, jobId: undefined })).toBe(false);
  });
  test('candidate only withdraws; org admin cannot appoint owner', () => {
    expect(can(actor('CANDIDATE'), 'change_application_status', { ...resource, requestedStatus: 'HIRED' })).toBe(false);
    expect(can(actor('ORG_ADMIN'), 'manage_members', { ...resource, requestedMemberRole: 'OWNER' })).toBe(false);
    expect(can(actor('OWNER'), 'delete_account', { ...resource, soleOwnerWithActiveSubscription: true })).toBe(false);
  });
  test.each(['talent_search', 'talent_invite', 'export_applications'] as const)('%s entitlement cannot be bypassed', (action) => expect(can({ ...actor('OWNER'), entitlements: [] }, action, resource)).toBe(false));
  test('unverified organization cannot access talents', () => expect(can({ ...actor('OWNER'), organizationContactVerified: false }, 'talent_search', resource)).toBe(false));
  test('public access needs a genuinely published job', () => expect(can(actor('NONE'), 'view_published_job', { published: false })).toBe(false));
  test('unknown role/action fails closed', () => {
    expect(can({ ...actor('NONE'), role: 'FAKE' as PermissionActor['role'] }, 'view_audit', resource)).toBe(false);
    expect(can(actor('ADMIN'), 'FAKE' as PermissionAction, resource)).toBe(false);
  });
});
