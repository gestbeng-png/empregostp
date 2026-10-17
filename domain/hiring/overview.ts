/**
 * R16/R21/R90/R91 — visão operacional do recrutamento. Puro e determinístico:
 * só conta o que existe nos dados (nada inventado, nada estimado).
 *
 * - «Novas» (R21): SUBMITTED e ainda nunca abertas (`firstViewedAt` vazio).
 * - «Precisa da sua atenção» (R16): só itens com contagem > 0, cada um com o
 *   separador e o filtro que o resolvem.
 * - Antes de fechar uma vaga (R91): quantas candidaturas ficam por resolver,
 *   por fase, e se há uma proposta ativa.
 */
const DAY_MS = 86_400_000;
/** R16: candidaturas por analisar há mais de 10 dias. */
export const STALE_APPLICATION_DAYS = 10;
/** R16: vaga a terminar nos próximos 2 dias. */
export const JOB_ENDING_DAYS = 2;
/** R16: proposta que expira nos próximos 7 dias. */
export const OFFER_EXPIRING_DAYS = 7;
export const UPCOMING_INTERVIEW_DAYS = 7;
export const HIRES_PERIOD_DAYS = 30;

const IN_REVIEW = new Set(['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED']);
const OPEN = new Set([...IN_REVIEW, 'INTERVIEW', 'OFFER']);
const LIVE_JOB = new Set(['PUBLISHED', 'ACTIVE', 'OPEN']);
const LIVE_INTERVIEW = new Set([
  'SCHEDULED',
  'CONFIRMED',
  'RESCHEDULE_REQUESTED',
]);

export interface OverviewApplication {
  jobId: string;
  status: string;
  submittedAt: string | null;
  firstViewedAt: string | null;
  lastStatusChangeAt: string | null;
}
export interface OverviewInterview {
  status: string;
  startsAt: string | null;
  hasFeedback: boolean;
}
export interface OverviewJob {
  id: string;
  status: string;
  applicationDeadline: string | null;
}
export interface OverviewOffer {
  status: string;
  expiresAt: string | null;
}

export type AttentionKey =
  | 'NEW_APPLICATIONS'
  | 'STALE_APPLICATIONS'
  | 'INTERVIEWS_WITHOUT_FEEDBACK'
  | 'OFFERS_EXPIRING'
  | 'JOBS_ENDING';
export interface AttentionItem {
  key: AttentionKey;
  count: number;
  label: string;
  /** Separador do espaço de recrutamento que resolve o item. */
  section: 'applications' | 'interviews' | 'jobs';
  /** Filtro rápido da lista de candidaturas, quando aplicável. */
  filter?: 'new' | 'stale';
}
export interface RecruitmentOverview {
  metrics: {
    openJobs: number;
    newApplications: number;
    toReview: number;
    upcomingInterviews: number;
    pendingOffers: number;
    hiresInPeriod: number;
    /** Média em dias entre receber e abrir pela 1.ª vez; null sem amostra. */
    avgDaysToFirstReview: number | null;
  };
  attention: AttentionItem[];
}

const time = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};
const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export const isNewApplication = (app: OverviewApplication): boolean =>
  app.status === 'SUBMITTED' && !app.firstViewedAt;

export function isStaleApplication(
  app: OverviewApplication,
  now: number,
): boolean {
  if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW') return false;
  const submitted = time(app.submittedAt);
  return (
    submitted !== null && now - submitted > STALE_APPLICATION_DAYS * DAY_MS
  );
}

export function buildRecruitmentOverview(input: {
  applications: readonly OverviewApplication[];
  interviews: readonly OverviewInterview[];
  jobs: readonly OverviewJob[];
  offers: readonly OverviewOffer[];
  now: number;
}): RecruitmentOverview {
  const { applications, interviews, jobs, offers, now } = input;
  const newApplications = applications.filter(isNewApplication).length;
  const stale = applications.filter((app) =>
    isStaleApplication(app, now),
  ).length;
  const toReview = applications.filter(
    (app) => app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW',
  ).length;
  const upcomingInterviews = interviews.filter((interview) => {
    const starts = time(interview.startsAt);
    return (
      LIVE_INTERVIEW.has(interview.status) &&
      starts !== null &&
      starts >= now &&
      starts - now <= UPCOMING_INTERVIEW_DAYS * DAY_MS
    );
  }).length;
  const withoutFeedback = interviews.filter((interview) => {
    if (interview.hasFeedback) return false;
    if (interview.status === 'COMPLETED') return true;
    const starts = time(interview.startsAt);
    return (
      LIVE_INTERVIEW.has(interview.status) && starts !== null && starts < now
    );
  }).length;
  const sentOffers = offers.filter((offer) => offer.status === 'SENT');
  const expiring = sentOffers.filter((offer) => {
    const expires = time(offer.expiresAt);
    return (
      expires !== null &&
      expires >= now &&
      expires - now <= OFFER_EXPIRING_DAYS * DAY_MS
    );
  }).length;
  const liveJobs = jobs.filter((job) => LIVE_JOB.has(job.status.toUpperCase()));
  const ending = liveJobs.filter((job) => {
    const deadline = time(job.applicationDeadline);
    return (
      deadline !== null &&
      deadline >= now &&
      deadline - now <= JOB_ENDING_DAYS * DAY_MS
    );
  }).length;
  const hiresInPeriod = applications.filter((app) => {
    const changed = time(app.lastStatusChangeAt);
    return (
      app.status === 'HIRED' &&
      changed !== null &&
      now - changed <= HIRES_PERIOD_DAYS * DAY_MS
    );
  }).length;
  const reviewDelays = applications
    .map((app) => {
      const submitted = time(app.submittedAt);
      const viewed = time(app.firstViewedAt);
      return submitted !== null && viewed !== null && viewed >= submitted
        ? (viewed - submitted) / DAY_MS
        : null;
    })
    .filter((value): value is number => value !== null);

  const attention: AttentionItem[] = [
    {
      key: 'NEW_APPLICATIONS' as const,
      count: newApplications,
      label: plural(
        newApplications,
        'candidatura nova por abrir',
        'candidaturas novas por abrir',
      ),
      section: 'applications' as const,
      filter: 'new' as const,
    },
    {
      key: 'STALE_APPLICATIONS' as const,
      count: stale,
      label: `${plural(stale, 'candidatura', 'candidaturas')} sem análise há mais de ${STALE_APPLICATION_DAYS} dias`,
      section: 'applications' as const,
      filter: 'stale' as const,
    },
    {
      key: 'INTERVIEWS_WITHOUT_FEEDBACK' as const,
      count: withoutFeedback,
      label: plural(
        withoutFeedback,
        'entrevista sem feedback',
        'entrevistas sem feedback',
      ),
      section: 'interviews' as const,
    },
    {
      key: 'OFFERS_EXPIRING' as const,
      count: expiring,
      label: `${plural(expiring, 'proposta expira', 'propostas expiram')} nos próximos ${OFFER_EXPIRING_DAYS} dias`,
      section: 'applications' as const,
    },
    {
      key: 'JOBS_ENDING' as const,
      count: ending,
      label: `${plural(ending, 'vaga termina', 'vagas terminam')} nos próximos ${JOB_ENDING_DAYS} dias`,
      section: 'jobs' as const,
    },
  ].filter((item) => item.count > 0);

  return {
    metrics: {
      openJobs: liveJobs.length,
      newApplications,
      toReview,
      upcomingInterviews,
      pendingOffers: sentOffers.length,
      hiresInPeriod,
      avgDaysToFirstReview: reviewDelays.length
        ? Math.round(
            (reviewDelays.reduce((sum, value) => sum + value, 0) /
              reviewDelays.length) *
              10,
          ) / 10
        : null,
    },
    attention,
  };
}

export interface ClosingSummary {
  open: number;
  inReview: number;
  interview: number;
  offer: number;
  hasActiveOffer: boolean;
}

/** R91: o que fica por resolver se a vaga fechar agora. */
export function summarizeOpenApplications(
  applications: readonly { status: string }[],
): ClosingSummary {
  const open = applications.filter((app) => OPEN.has(app.status));
  const offer = open.filter((app) => app.status === 'OFFER').length;
  return {
    open: open.length,
    inReview: open.filter((app) => IN_REVIEW.has(app.status)).length,
    interview: open.filter((app) => app.status === 'INTERVIEW').length,
    offer,
    hasActiveOffer: offer > 0,
  };
}
