import { closeEndedJobApplications } from '@/infrastructure/firebase/jobs/closeEndedJobApplications';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

const now = new Date('2026-10-22T12:00:00Z');
const ended = {
  status: 'closed',
  v2Status: 'EXPIRED',
  jobEndState: 'EXPIRED',
  jobEndPending: true,
  jobEndedAt: '2026-10-10T12:00:00Z',
  titulo: 'Motorista',
  companyName: 'Empresa',
};

function setup() {
  return createFakeFirestore({
    'jobs/job-1': ended,
    'applications/a1': {
      jobId: 'job-1',
      candidateUserId: 'candidate-1',
      status: 'analysis',
      v2Status: 'UNDER_REVIEW',
      version: 2,
    },
  });
}

test('an ended job closes open applications once with history and notification', async () => {
  const { db, docs } = setup();
  expect(await closeEndedJobApplications(db, now)).toMatchObject({
    jobsCompleted: 1,
    applicationsClosed: 1,
  });
  expect(docs.get('applications/a1')).toMatchObject({
    status: 'rejected',
    v2Status: 'REJECTED',
    version: 3,
  });
  expect(
    [...docs.keys()].filter((path) => path.startsWith('notifications/')),
  ).toHaveLength(1);
  expect(
    [...docs.keys()].filter((path) =>
      path.startsWith('applicationsStatusHistory/'),
    ),
  ).toHaveLength(1);
  expect(await closeEndedJobApplications(db, now)).toMatchObject({
    jobsScanned: 0,
    applicationsClosed: 0,
  });
});

test.each([
  {
    status: 'active',
    v2Status: 'PUBLISHED',
    jobEndPending: false,
    jobEndedAt: null,
  },
  {
    status: 'closed',
    v2Status: 'CLOSED',
    jobEndPending: true,
    jobEndState: 'CLOSED',
    jobEndedAt: '2026-10-22T11:00:00Z',
  },
])(
  'a stale cron selection cannot reject applications or clear a newer end marker: %j',
  async (change) => {
    const { db, docs } = setup();
    const runTransaction = db.runTransaction.bind(db);
    let changed = false;
    jest.spyOn(db, 'runTransaction').mockImplementation((callback) => {
      if (!changed) {
        docs.set('jobs/job-1', { ...ended, ...change });
        changed = true;
      }
      return runTransaction(callback);
    });
    expect(await closeEndedJobApplications(db, now)).toMatchObject({
      jobsScanned: 1,
      jobsCompleted: 0,
      applicationsClosed: 0,
    });
    expect(docs.get('applications/a1')).toMatchObject({
      v2Status: 'UNDER_REVIEW',
      version: 2,
    });
    expect(docs.get('jobs/job-1')).toMatchObject(change);
    expect(
      [...docs.keys()].filter((path) => path.startsWith('notifications/')),
    ).toHaveLength(0);
  },
);
