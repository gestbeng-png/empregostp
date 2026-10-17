import { getHireService } from '@/infrastructure/firebase/hires/createHireService';
import {
  runEmployerSilenceReminders,
  withCronLock,
} from '@/infrastructure/firebase/jobs/atsScheduledJobs';
import { getFeatureEnvironment } from '@/infrastructure/firebase/marketplace/environment';
import { FirestoreFeatureFlags } from '@/infrastructure/firebase/marketplace/FirestoreFeatureFlags';
import { admin } from '@/lib/firebaseAdmin';
import { createV2CronHandler } from '@/presentation/cron/createV2CronHandler';

/** D12 diários: `employerSilenceReminders` (09:00 STP) e `hireConfirmationFollowUp`. */
export default createV2CronHandler('ats_daily', 'V2_ATS_CRON_ENABLED', () => {
  const db = admin.firestore();
  return withCronLock(db, 'atsDaily', 30 * 60_000, Date.now, async () => ({
    silence: await runEmployerSilenceReminders(
      db,
      new FirestoreFeatureFlags(db),
      { environment: getFeatureEnvironment() },
    ),
    hires: await getHireService().followUp(),
  }));
});
