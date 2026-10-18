import { readRecruitmentWorkspace } from '@/infrastructure/firebase/applications/readRecruitmentWorkspace';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

import { createFakeFirestore } from '../../helpers/fakeFirestore';
jest.mock('firebase-admin/firestore', () => ({ Timestamp: {} }));
const org = 'company-1';
const organizations = [{ organizationId: org, role: 'OWNER' as const }];
function setup() {
  return createFakeFirestore({
    [`users/${org}`]: { userType: 'empresa' },
    'applications/a': {
      organizationId: org,
      jobId: 'j',
      v2Status: 'SUBMITTED',
      version: 1,
      candidateSnapshot: {
        fullName: 'Ana',
        contacts: { email: 'PRIVATE_CONTACT' },
      },
      cvSnapshotKey: 'PRIVATE_CV',
      internalNotes: 'PRIVATE_NOTE',
      id: 'SPOOFED',
    },
    'applications/foreign': {
      organizationId: 'foreign',
      jobId: 'f',
      v2Status: 'SUBMITTED',
    },
    'jobs/j': {
      organizationId: org,
      companyId: org,
      titulo: 'Assistente',
      v2Status: 'PUBLISHED',
      privateField: 'PRIVATE_JOB',
    },
    'interviews/i': {
      organizationId: org,
      jobId: 'j',
      applicationId: 'a',
      v2Status: 'SCHEDULED',
      startsAt: '2026-10-20T10:00:00Z',
      timezone: 'Africa/Sao_Tome',
      notes: 'PRIVATE_FEEDBACK',
      interviewerUserIds: ['PRIVATE_INTERVIEWER'],
    },
    'organizationInvitations/inv': {
      organizationId: org,
      v2Status: 'PENDING',
      email: 'invited@example.test',
      role: 'RECRUITER',
      tokenHash: 'PRIVATE_HASH',
    },
  });
}
test('foreign organization is rejected before any database access', async () => {
  const { db } = setup();
  const spy = jest.spyOn(db, 'collection');
  expect(
    await readRecruitmentWorkspace(db, org, 'foreign', organizations),
  ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  expect(spy).not.toHaveBeenCalled();
});
test('read bootstrap has canonical IDs, deduplicated jobs, allowlisted projections and no automatic first-view mutation', async () => {
  const { db, docs } = setup();
  const before = JSON.stringify([...docs]);
  const result = await readRecruitmentWorkspace(db, org, org, organizations);
  expect(result).toMatchObject({
    ok: true,
    value: {
      applications: [
        {
          id: 'a',
          candidateName: 'Ana',
          permissions: { notes: true, transition: true, hire: true },
        },
      ],
      jobs: [{ id: 'j' }],
      interviews: [{ id: 'i', canManage: true }],
    },
  });
  if (!result.ok) throw new Error('unexpected failure');
  expect(result.value.jobs).toHaveLength(1);
  expect(JSON.stringify(result.value)).not.toMatch(/PRIVATE_|SPOOFED|foreign/);
  expect(JSON.stringify([...docs])).toBe(before);
});
test('recruiter sees only assigned applications/jobs/interviews and cannot manage team', async () => {
  const { db, docs } = setup();
  docs.set('users/recruiter', { userType: 'candidato' });
  docs.set(`organizationMemberships/${membershipId('recruiter', org)}`, {
    userId: 'recruiter',
    organizationId: org,
    status: 'ACTIVE',
    role: 'RECRUITER',
    assignedJobIds: ['j'],
  });
  docs.set('applications/unassigned', {
    organizationId: org,
    jobId: 'unassigned',
    v2Status: 'SUBMITTED',
  });
  const result = await readRecruitmentWorkspace(db, 'recruiter', org, [
    { organizationId: org, role: 'RECRUITER' },
  ]);
  expect(result).toMatchObject({
    ok: true,
    value: {
      applications: [{ id: 'a' }],
      capabilities: { manageTeam: false },
      invitations: [],
    },
  });
  if (!result.ok) throw new Error('unexpected failure');
  expect(result.value.applications).toHaveLength(1);
});
test('revoked memberships cannot bootstrap even if organization list is stale', async () => {
  const { db, docs } = setup();
  docs.set('users/invited', { userType: 'candidato' });
  docs.set(`organizationMemberships/${membershipId('invited', org)}`, {
    userId: 'invited',
    organizationId: org,
    status: 'REMOVED',
    role: 'ADMIN',
  });
  expect(
    await readRecruitmentWorkspace(db, 'invited', org, [
      { organizationId: org, role: 'ADMIN' },
    ]),
  ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
});
