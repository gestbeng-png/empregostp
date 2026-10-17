import { FirestoreHealthProbe } from '@/infrastructure/firebase/marketplace/FirestoreHealthProbe';
import { admin } from '@/lib/firebaseAdmin';
import { createHealthHandler } from '@/presentation/health/createHealthHandler';

export default createHealthHandler(
  () =>
    new FirestoreHealthProbe(
      admin.firestore(),
      async () => (await admin.storage().bucket().exists())[0],
    ),
);
