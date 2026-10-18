import { createOutboxRuntime } from '@/infrastructure/firebase/marketplace/createOutboxRuntime';
import { admin } from '@/lib/firebaseAdmin';
import { createOutboxCronHandler } from '@/presentation/outbox/createOutboxCronHandler';

export default createOutboxCronHandler(
  () => createOutboxRuntime(admin.firestore()),
  {
    secret: () => process.env.CRON_SECRET,
  },
);
