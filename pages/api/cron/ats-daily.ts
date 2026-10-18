import { getHireService } from '@/infrastructure/firebase/hires/createHireService';
import {
  runEmployerSilenceReminders,
  withCronLock,
} from '@/infrastructure/firebase/jobs/atsScheduledJobs';
import { admin } from '@/lib/firebaseAdmin';
import { createCronHandler } from '@/presentation/cron/createCronHandler';

/** D12 diários: `employerSilenceReminders` (09:00 STP) e `hireConfirmationFollowUp`. */
export default createCronHandler('ats_daily', () => {
  const db = admin.firestore();
  return withCronLock(db, 'atsDaily', 30 * 60_000, Date.now, async () => ({
    silence: await runEmployerSilenceReminders(db),
    hires: await getHireService().followUp(),
  }));
});
