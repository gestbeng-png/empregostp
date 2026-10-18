import {
  buildRecruitmentOverview,
  summarizeOpenApplications,
} from '@/domain/hiring/overview';

const now = Date.parse('2026-10-20T12:00:00.000Z');
const daysAgo = (days: number) =>
  new Date(now - days * 86_400_000).toISOString();
const inDays = (days: number) =>
  new Date(now + days * 86_400_000).toISOString();
const app = (
  status: string,
  extra: Partial<{
    submittedAt: string | null;
    firstViewedAt: string | null;
    lastStatusChangeAt: string | null;
  }> = {},
) => ({
  jobId: 'j1',
  status,
  submittedAt: daysAgo(1),
  firstViewedAt: null,
  lastStatusChangeAt: null,
  ...extra,
});

describe('R16/R21 — visão operacional do recrutamento', () => {
  test('conta só dados reais e lista apenas o que precisa de atenção', () => {
    const overview = buildRecruitmentOverview({
      now,
      applications: [
        app('SUBMITTED'),
        app('SUBMITTED'),
        app('SUBMITTED', { firstViewedAt: daysAgo(0.5) }),
        app('UNDER_REVIEW', {
          submittedAt: daysAgo(12),
          firstViewedAt: daysAgo(9),
        }),
        app('HIRED', { lastStatusChangeAt: daysAgo(3) }),
        app('HIRED', { lastStatusChangeAt: daysAgo(45) }),
        app('REJECTED', { submittedAt: daysAgo(30) }),
      ],
      interviews: [
        { status: 'SCHEDULED', startsAt: inDays(2), hasFeedback: false },
        { status: 'COMPLETED', startsAt: daysAgo(1), hasFeedback: false },
        { status: 'CONFIRMED', startsAt: daysAgo(2), hasFeedback: true },
      ],
      jobs: [
        { id: 'j1', status: 'PUBLISHED', applicationDeadline: inDays(1) },
        { id: 'j2', status: 'active', applicationDeadline: inDays(20) },
        { id: 'j3', status: 'CLOSED', applicationDeadline: inDays(1) },
      ],
      offers: [
        { status: 'SENT', expiresAt: inDays(3) },
        { status: 'SENT', expiresAt: inDays(20) },
        { status: 'ACCEPTED', expiresAt: inDays(1) },
      ],
    });
    expect(overview.metrics).toEqual({
      openJobs: 2,
      newApplications: 2,
      toReview: 4,
      upcomingInterviews: 1,
      pendingOffers: 2,
      hiresInPeriod: 1,
      avgDaysToFirstReview: 1.8,
    });
    expect(overview.attention.map((item) => [item.key, item.count])).toEqual([
      ['NEW_APPLICATIONS', 2],
      ['STALE_APPLICATIONS', 1],
      ['INTERVIEWS_WITHOUT_FEEDBACK', 1],
      ['OFFERS_EXPIRING', 1],
      ['JOBS_ENDING', 1],
    ]);
    expect(overview.attention[1]).toMatchObject({
      label: '1 candidatura sem análise há mais de 10 dias',
      section: 'applications',
      filter: 'stale',
    });
  });

  test('sem dados, nada a assinalar e sem médias inventadas', () => {
    const overview = buildRecruitmentOverview({
      now,
      applications: [],
      interviews: [],
      jobs: [],
      offers: [],
    });
    expect(overview.attention).toEqual([]);
    expect(overview.metrics.avgDaysToFirstReview).toBeNull();
  });

  test('R91: resumo do que fica por resolver ao fechar', () => {
    expect(
      summarizeOpenApplications([
        { status: 'SUBMITTED' },
        { status: 'SHORTLISTED' },
        { status: 'INTERVIEW' },
        { status: 'OFFER' },
        { status: 'HIRED' },
        { status: 'WITHDRAWN' },
      ]),
    ).toEqual({
      open: 4,
      inReview: 2,
      interview: 1,
      offer: 1,
      hasActiveOffer: true,
    });
  });
});
