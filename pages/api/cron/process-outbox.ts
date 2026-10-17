import { createOutboxRuntime } from '@/infrastructure/firebase/marketplace/createOutboxRuntime';
import { getFeatureEnvironment } from '@/infrastructure/firebase/marketplace/environment';
import { admin } from '@/lib/firebaseAdmin';
import { createOutboxCronHandler } from '@/presentation/outbox/createOutboxCronHandler';

export default createOutboxCronHandler(
  () =>
    createOutboxRuntime(admin.firestore(), {
      environment: getFeatureEnvironment(),
    }),
  {
    secret: () => process.env.CRON_SECRET,
    armed: () => process.env.V2_OUTBOX_PROCESSOR_ENABLED === 'true',
  },
);
