import {
  runInterviewReminders,
  withCronLock,
} from '@/infrastructure/firebase/jobs/atsScheduledJobs';
import { admin } from '@/lib/firebaseAdmin';
import { createCronHandler } from '@/presentation/cron/createCronHandler';

/** D12 `interviewReminders`: cadência do workflow GitHub (30 min); não agendado na Vercel. */
export default createCronHandler('interview_reminders', () => {
  const db = admin.firestore();
  return withCronLock(db, 'interviewReminders', 10 * 60_000, Date.now, () =>
    runInterviewReminders(db),
  );
});
