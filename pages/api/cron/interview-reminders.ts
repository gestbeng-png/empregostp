import {
  runInterviewReminders,
  withCronLock,
} from '@/infrastructure/firebase/jobs/atsScheduledJobs';
import { getFeatureEnvironment } from '@/infrastructure/firebase/marketplace/environment';
import { FirestoreFeatureFlags } from '@/infrastructure/firebase/marketplace/FirestoreFeatureFlags';
import { admin } from '@/lib/firebaseAdmin';
import { createV2CronHandler } from '@/presentation/cron/createV2CronHandler';

/** D12 `interviewReminders`: cadência do workflow GitHub (30 min); não agendado na Vercel. */
export default createV2CronHandler(
  'interview_reminders',
  'V2_ATS_CRON_ENABLED',
  () => {
    const db = admin.firestore();
    return withCronLock(db, 'interviewReminders', 10 * 60_000, Date.now, () =>
      runInterviewReminders(db, new FirestoreFeatureFlags(db), {
        environment: getFeatureEnvironment(),
      }),
    );
  },
);
