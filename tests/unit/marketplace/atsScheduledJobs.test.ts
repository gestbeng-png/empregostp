import {
  runEmployerSilenceReminders,
  runInterviewReminders,
  withCronLock,
} from '@/infrastructure/firebase/jobs/atsScheduledJobs';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromMillis: (ms: number) => ({
      ms,
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  },
}));

const H = 3_600_000;
const ts = (ms: number) => ({ toDate: () => new Date(ms) });
const events = (docs: Map<string, Record<string, unknown>>) =>
  [...docs.entries()]
    .filter(([p]) => p.startsWith('outboxEvents/'))
    .map(([, d]) => d);

describe('D12 — lembretes de entrevista', () => {
  test('24 h e 2 h, uma vez por janela', async () => {
    let now = Date.parse('2026-10-10T08:00:00Z');
    const { db, docs } = createFakeFirestore({
      'interviews/i1': {
        v2Status: 'SCHEDULED',
        organizationId: 'o',
        startsAt: ts(now + 23 * H),
        remindersSent: [],
      },
      'interviews/i2': {
        v2Status: 'CANCELLED',
        organizationId: 'o',
        startsAt: ts(now + 1 * H),
        remindersSent: [],
      },
      'interviews/i3': {
        v2Status: 'CONFIRMED',
        organizationId: 'o',
        startsAt: ts(now + 60 * H),
        remindersSent: [],
      },
    });
    expect(await runInterviewReminders(db, () => now)).toEqual({
      queued: 1,
    });
    expect(await runInterviewReminders(db, () => now)).toEqual({
      queued: 0,
    });
    now += 21.5 * H;
    expect(await runInterviewReminders(db, () => now)).toEqual({
      queued: 1,
    });
    expect(docs.get('interviews/i1')?.remindersSent).toEqual(['24H', '2H']);
    expect(events(docs).map((e) => e.payload)).toEqual([
      { interviewId: 'i1', window: '24H' },
      { interviewId: 'i1', window: '2H' },
    ]);
  });
});

describe('F2.8 — silêncio do empregador', () => {
  const monday = Date.parse('2026-10-05T09:00:00Z');
  const seed = () =>
    createFakeFirestore({
      'applications/a1': {
        v2Status: 'SUBMITTED',
        jobId: 'j1',
        organizationId: 'o',
        submittedAt: ts(monday),
      },
      'applications/a2': {
        v2Status: 'SUBMITTED',
        jobId: 'j1',
        organizationId: 'o',
        submittedAt: ts(monday + 48 * H),
      },
      'applications/a3': {
        v2Status: 'UNDER_REVIEW',
        jobId: 'j2',
        organizationId: 'o',
        submittedAt: ts(monday),
      },
    });

  test('D+5 lembra uma vez; D+15 cria alerta interno sem penalizar', async () => {
    const { db, docs } = seed();
    const d5 = Date.parse('2026-10-12T09:00:00Z');
    expect(await runEmployerSilenceReminders(db, () => d5)).toEqual({
      reminders: 1,
      staffFlags: 0,
    });
    expect(await runEmployerSilenceReminders(db, () => d5)).toEqual({
      reminders: 0,
      staffFlags: 0,
    });
    const d15 = Date.parse('2026-10-26T09:00:00Z');
    expect(await runEmployerSilenceReminders(db, () => d15)).toEqual({
      reminders: 0,
      staffFlags: 1,
    });
    expect(docs.get('jobInternals/j1')?.silenceStagesSent).toEqual([
      'REMINDER_D5',
      'REMINDER_D10',
      'STAFF_FLAG_D15',
    ]);
    expect(docs.get('staffFollowUps/silence_j1')).toMatchObject({
      kind: 'EMPLOYER_SILENCE_D15',
      status: 'OPEN',
    });
    expect(events(docs).map((e) => e.payload)).toEqual([
      { jobId: 'j1', stage: 'REMINDER_D5' },
      { jobId: 'j1', stage: 'STAFF_FLAG_D15' },
    ]);
    expect(docs.get('jobs/j1')).toBeUndefined();
  });

  test('adiado 7 dias: lembretes param, o alerta interno não', async () => {
    const { db, docs } = seed();
    docs.set('jobInternals/j1', {
      silenceSnoozedUntilMs: Date.parse('2026-10-30T00:00:00Z'),
    });
    expect(
      await runEmployerSilenceReminders(db, () =>
        Date.parse('2026-10-19T09:00:00Z'),
      ),
    ).toEqual({ reminders: 0, staffFlags: 0 });
    expect(
      await runEmployerSilenceReminders(db, () =>
        Date.parse('2026-10-26T09:00:00Z'),
      ),
    ).toEqual({ reminders: 0, staffFlags: 1 });
  });
});

describe('D12 — lock', () => {
  test('não corre em paralelo e liberta no fim', async () => {
    const { db } = createFakeFirestore();
    let now = 1000;
    const inner = await withCronLock(
      db,
      'x',
      60_000,
      () => now,
      async () =>
        withCronLock(
          db,
          'x',
          60_000,
          () => now,
          async () => 'nested',
        ),
    );
    expect(inner).toEqual({ ran: true, result: { ran: false } });
    now += 1;
    expect(
      await withCronLock(
        db,
        'x',
        60_000,
        () => now,
        async () => 'again',
      ),
    ).toEqual({ ran: true, result: 'again' });
  });
});
