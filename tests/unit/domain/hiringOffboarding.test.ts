import {
  needsTransfer,
  reassignInterviewers,
  reassignTeam,
  summarizeResponsibilities,
  validateTransferTarget,
} from '@/domain/hiring/offboarding';

const now = Date.parse('2026-10-20T12:00:00Z');

describe('R57/R58 — saída de um membro', () => {
  const responsibilities = summarizeResponsibilities('joao', {
    now,
    processes: [
      { jobId: 'j1', members: [{ userId: 'joao', role: 'LEAD_RECRUITER' }] },
      { jobId: 'j2', members: [{ userId: 'joao', role: 'INTERVIEWER' }] },
      { jobId: 'j3', members: [{ userId: 'ana', role: 'LEAD_RECRUITER' }] },
    ],
    assignments: [
      { applicationId: 'a1', userId: 'joao', applicationStatus: 'SUBMITTED' },
      { applicationId: 'a2', userId: 'joao', applicationStatus: 'HIRED' },
      { applicationId: 'a3', userId: 'ana', applicationStatus: 'SUBMITTED' },
    ],
    interviews: [
      {
        id: 'i1',
        status: 'SCHEDULED',
        startsAt: now + 1,
        interviewerUserIds: ['joao'],
      },
      {
        id: 'i2',
        status: 'SCHEDULED',
        startsAt: now - 1,
        interviewerUserIds: ['joao'],
      },
      {
        id: 'i3',
        status: 'CANCELLED',
        startsAt: now + 1,
        interviewerUserIds: ['joao'],
      },
    ],
  });

  test('distingue o que tem de passar do que simplesmente termina', () => {
    expect(responsibilities).toEqual({
      leadJobIds: ['j1'],
      supportJobIds: ['j2'],
      assignedApplicationIds: ['a1'],
      upcomingInterviewIds: ['i1'],
    });
    expect(needsTransfer(responsibilities)).toBe(true);
    expect(
      needsTransfer({
        ...responsibilities,
        leadJobIds: [],
        assignedApplicationIds: [],
        upcomingInterviewIds: [],
      }),
    ).toBe(false);
  });

  test('exige destino válido quando há responsabilidades', () => {
    expect(
      validateTransferTarget('joao', responsibilities, {
        userId: null,
        role: null,
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(
      validateTransferTarget('joao', responsibilities, {
        userId: 'joao',
        role: 'RECRUITER',
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateTransferTarget('joao', responsibilities, {
        userId: 'carla',
        role: 'REVIEWER',
      }),
    ).toMatchObject({
      ok: false,
      error: { message: expect.stringMatching(/recrutador/) },
    });
    expect(
      validateTransferTarget('joao', responsibilities, {
        userId: 'ana',
        role: 'RECRUITER',
      }),
    ).toEqual({ ok: true, value: 'ana' });
  });

  test('a equipa: quem recebe passa a responsável; funções de apoio terminam', () => {
    expect(
      reassignTeam(
        [
          { userId: 'joao', role: 'LEAD_RECRUITER' },
          { userId: 'ana', role: 'INTERVIEWER' },
          { userId: 'rui', role: 'OBSERVER' },
        ],
        'joao',
        'ana',
        false,
      ),
    ).toEqual([
      { userId: 'ana', role: 'LEAD_RECRUITER' },
      { userId: 'rui', role: 'OBSERVER' },
    ]);
    expect(
      reassignTeam(
        [{ userId: 'joao', role: 'INTERVIEWER' }],
        'joao',
        'ana',
        true,
      ),
    ).toEqual([{ userId: 'ana', role: 'RECRUITER' }]);
    expect(
      reassignTeam([{ userId: 'joao', role: 'OBSERVER' }], 'joao', null, false),
    ).toEqual([]);
    expect(reassignInterviewers(['joao', 'ana'], 'joao', 'ana')).toEqual([
      'ana',
    ]);
  });
});
