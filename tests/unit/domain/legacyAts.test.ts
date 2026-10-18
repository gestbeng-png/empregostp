import { planLegacyAtsTransition } from '@/domain/applications/legacyAts';

describe('D7 — ATS atual sobre candidaturas v2', () => {
  test.each([
    ['SUBMITTED', 'analysis', ['UNDER_REVIEW']],
    ['UNDER_REVIEW', 'analysis', []],
    ['INTERVIEW', 'analysis', ['UNDER_REVIEW']],
    ['SUBMITTED', 'interview', ['UNDER_REVIEW', 'INTERVIEW']],
    ['SHORTLISTED', 'interview', ['INTERVIEW']],
    ['INTERVIEW', 'interview', []],
    ['SUBMITTED', 'approved', ['UNDER_REVIEW', 'SHORTLISTED', 'HIRED']],
    ['INTERVIEW', 'approved', ['HIRED']],
    ['SUBMITTED', 'rejected', ['REJECTED']],
    ['OFFER', 'rejected', ['REJECTED']],
    ['SUBMITTED', 'pending', []],
  ] as const)('%s + %s → %p', (current, target, steps) => {
    const plan = planLegacyAtsTransition(current, target);
    expect(plan).toMatchObject({ ok: true, steps });
  });

  test('rejeição leva motivo; aprovação cria contratação (E5.5)', () => {
    expect(planLegacyAtsTransition('UNDER_REVIEW', 'rejected')).toEqual({
      ok: true,
      steps: ['REJECTED'],
      closedReason: 'NOT_SELECTED',
      createsHire: false,
    });
    expect(planLegacyAtsTransition('SHORTLISTED', 'approved')).toMatchObject({
      createsHire: true,
      closedReason: null,
    });
  });

  test.each([
    ['UNDER_REVIEW', 'pending'],
    ['WITHDRAWN', 'analysis'],
    ['WITHDRAWN', 'rejected'],
    ['HIRED', 'rejected'],
    ['REJECTED', 'interview'],
    ['OFFER', 'interview'],
    ['OFFER', 'approved'],
  ] as const)('%s + %s é recusado', (current, target) => {
    expect(planLegacyAtsTransition(current, target)).toEqual({
      ok: false,
      code: 'TRANSITION_NOT_ALLOWED',
    });
  });
});
