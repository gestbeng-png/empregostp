import { resolveRecruitmentNotice } from '@/infrastructure/firebase/marketplace/RecruitmentNotificationResolver';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

const event = (type: string, payload: Record<string, string>) =>
  ({ id: 'e1', type, payload }) as never;

describe('R94/R95 — avisos de equipa', () => {
  test('candidatura atribuída: só in-app, só se a atribuição ainda for atual', async () => {
    const { db, docs } = createFakeFirestore({
      'applicationAssignments/a1': { userId: 'ana' },
      'applications/a1': {
        jobTitle: 'Contabilista',
        candidateSnapshot: { fullName: 'PRIVADO' },
      },
    });
    const notice = await resolveRecruitmentNotice(
      db,
      event('application_assigned', {
        applicationId: 'a1',
        assigneeUserId: 'ana',
      }),
    );
    expect(notice).toMatchObject({
      userId: 'ana',
      email: null,
      type: 'APPLICATION_ASSIGNED',
      path: '/dashboard/recrutamento',
    });
    expect(JSON.stringify(notice)).not.toMatch(/PRIVADO/);
    docs.set('applicationAssignments/a1', { userId: 'bruno' });
    expect(
      await resolveRecruitmentNotice(
        db,
        event('application_assigned', {
          applicationId: 'a1',
          assigneeUserId: 'ana',
        }),
      ),
    ).toBeNull();
  });

  test('equipa da vaga: só quem ainda está na equipa', async () => {
    const { db, docs } = createFakeFirestore({
      'hiringProcesses/j1': { memberIds: ['ana'] },
      'jobs/j1': { titulo: 'Motorista' },
    });
    expect(
      await resolveRecruitmentNotice(
        db,
        event('hiring_team_assigned', { jobId: 'j1', userId: 'ana' }),
      ),
    ).toMatchObject({
      userId: 'ana',
      email: null,
      type: 'JOB_ASSIGNED',
      body: expect.stringContaining('Motorista'),
    });
    docs.set('hiringProcesses/j1', { memberIds: [] });
    expect(
      await resolveRecruitmentNotice(
        db,
        event('hiring_team_assigned', { jobId: 'j1', userId: 'ana' }),
      ),
    ).toBeNull();
  });
});
