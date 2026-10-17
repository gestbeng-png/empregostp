import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import type { FeatureFlagReader } from '@/application/marketplace/ports';
import { employerSilenceStage } from '@/domain/applications/jobEnd';
import type { SilenceStage } from '@/domain/applications/jobEnd';
import type { FeatureContext } from '@/domain/feature-flags/flags';
import { dueInterviewReminders } from '@/domain/interviews/schedule';

type Plain = Record<string, unknown>;
const HOUR_MS = 3_600_000;
const STAGE_ORDER: readonly SilenceStage[] = [
  'REMINDER_D5',
  'REMINDER_D10',
  'STAFF_FLAG_D15',
];

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value)
    return (value as { toDate: () => Date }).toDate();
  return null;
}

/** D12: um job de cada vez — lease em `cronLocks/{nome}` (nunca bloqueia candidaturas). */
export async function withCronLock<T>(
  db: Firestore,
  name: string,
  leaseMs: number,
  now: () => number,
  fn: () => Promise<T>,
): Promise<{ ran: false } | { ran: true; result: T }> {
  const ref = db.collection('cronLocks').doc(name);
  const owner = `${now()}-${Math.random().toString(36).slice(2, 10)}`;
  const acquired = await db.runTransaction(async (tx) => {
    const lock = (await tx.get(ref)).data();
    if (
      lock &&
      typeof lock.leaseUntilMs === 'number' &&
      lock.leaseUntilMs > now()
    )
      return false;
    tx.set(ref, { owner, leaseUntilMs: now() + leaseMs, startedAtMs: now() });
    return true;
  });
  if (!acquired) return { ran: false };
  try {
    return { ran: true, result: await fn() };
  } finally {
    await ref.set({ owner, leaseUntilMs: 0, finishedAtMs: now() });
  }
}

/** E6 — lembretes 24 h e 2 h: marca a janela e cria o evento na mesma transação. */
export async function runInterviewReminders(
  db: Firestore,
  flags: FeatureFlagReader,
  context: FeatureContext,
  now: () => number = Date.now,
): Promise<{ queued: number }> {
  const result = { queued: 0 };
  const candidates: (Plain & { id: string })[] = [];
  for (const status of ['SCHEDULED', 'CONFIRMED']) {
    const page = await db
      .collection('interviews')
      .where('v2Status', '==', status)
      .limit(500)
      .get();
    for (const doc of page.docs) {
      const startsAt = toDate(doc.data().startsAt);
      if (
        startsAt &&
        startsAt.getTime() > now() &&
        startsAt.getTime() - now() <= 25 * HOUR_MS
      )
        candidates.push({ id: doc.id, ...doc.data() });
    }
  }
  const due = dueInterviewReminders(
    candidates.map((item) => ({
      id: item.id,
      status: String(item.v2Status),
      startsAt: toDate(item.startsAt) as Date,
      remindersSent: Array.isArray(item.remindersSent)
        ? (item.remindersSent as string[])
        : [],
    })),
    new Date(now()),
  );
  for (const { interviewId, window } of due) {
    const interview = candidates.find((item) => item.id === interviewId);
    if (
      !(await flags.enabled('V2_INTERVIEWS_OFFERS', {
        ...context,
        organizationId: String(interview?.organizationId ?? ''),
      }))
    )
      continue;
    const ref = db.collection('interviews').doc(interviewId);
    const queued = await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(ref)).data();
      const sent = Array.isArray(fresh?.remindersSent)
        ? (fresh?.remindersSent as string[])
        : [];
      if (
        !fresh ||
        sent.includes(window) ||
        !['SCHEDULED', 'CONFIRMED'].includes(String(fresh.v2Status))
      )
        return false;
      tx.update(ref, { remindersSent: [...sent, window] });
      tx.create(db.collection('outboxEvents').doc(), {
        type: 'interview_reminder',
        schemaVersion: 1,
        payload: { interviewId, window },
        status: 'PENDING',
        attempts: 0,
        createdAtMs: now(),
        nextAttemptAtMs: now(),
      });
      return true;
    });
    if (queued) result.queued++;
  }
  return result;
}

/**
 * F2.8 — silêncio do empregador (dias úteis desde a candidatura mais antiga
 * ainda «Recebida»): D+5 e D+10 lembretes; D+15 alerta interno para contacto
 * humano. Sem penalização automática. Cada etapa só uma vez por vaga.
 */
export async function runEmployerSilenceReminders(
  db: Firestore,
  flags: FeatureFlagReader,
  context: FeatureContext,
  now: () => number = Date.now,
): Promise<{ reminders: number; staffFlags: number }> {
  const result = { reminders: 0, staffFlags: 0 };
  const submitted = await db
    .collection('applications')
    .where('v2Status', '==', 'SUBMITTED')
    .limit(2000)
    .get();
  const oldest = new Map<string, { at: Date; organizationId: string }>();
  for (const doc of submitted.docs) {
    const data = doc.data();
    const at = toDate(data.submittedAt);
    const jobId = typeof data.jobId === 'string' ? data.jobId : '';
    if (!at || !jobId) continue;
    const current = oldest.get(jobId);
    if (!current || at < current.at)
      oldest.set(jobId, {
        at,
        organizationId: String(data.organizationId ?? ''),
      });
  }
  for (const [jobId, { at, organizationId }] of oldest) {
    const stage = employerSilenceStage(at, new Date(now()));
    if (
      !stage ||
      !(await flags.enabled('V2_EMPLOYER_ATS', { ...context, organizationId }))
    )
      continue;
    const ref = db.collection('jobInternals').doc(jobId);
    const outcome = await db.runTransaction(async (tx) => {
      const internals = (await tx.get(ref)).data() ?? {};
      const sent = Array.isArray(internals.silenceStagesSent)
        ? (internals.silenceStagesSent as string[])
        : [];
      const snoozed =
        typeof internals.silenceSnoozedUntilMs === 'number' &&
        internals.silenceSnoozedUntilMs > now();
      // Só a etapa mais avançada atingida; etapas saltadas não se repetem.
      if (sent.includes(stage) || (snoozed && stage !== 'STAFF_FLAG_D15'))
        return null;
      const reached = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stage) + 1);
      tx.set(
        ref,
        { silenceStagesSent: [...new Set([...sent, ...reached])] },
        { merge: true },
      );
      tx.create(db.collection('outboxEvents').doc(), {
        type: 'employer_silence_reminder',
        schemaVersion: 1,
        payload: { jobId, stage },
        status: 'PENDING',
        attempts: 0,
        createdAtMs: now(),
        nextAttemptAtMs: now(),
      });
      if (stage === 'STAFF_FLAG_D15')
        tx.set(db.collection('staffFollowUps').doc(`silence_${jobId}`), {
          kind: 'EMPLOYER_SILENCE_D15',
          jobId,
          organizationId,
          oldestSubmittedAt: Timestamp.fromMillis(at.getTime()),
          status: 'OPEN',
          createdAt: Timestamp.fromMillis(now()),
        });
      return stage;
    });
    if (outcome === 'STAFF_FLAG_D15') result.staffFlags++;
    else if (outcome) result.reminders++;
  }
  return result;
}
