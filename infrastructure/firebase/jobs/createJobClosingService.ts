import { admin } from '@/lib/firebaseAdmin';

import { FirestoreJobClosingService } from './FirestoreJobClosingService';

export function getJobClosingService(): FirestoreJobClosingService {
  const db = admin.firestore();
  return new FirestoreJobClosingService(db);
}
