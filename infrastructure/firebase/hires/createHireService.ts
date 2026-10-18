import { admin } from '@/lib/firebaseAdmin';

import { FirestoreHireService } from './FirestoreHireService';

export function getHireService(): FirestoreHireService {
  const db = admin.firestore();
  return new FirestoreHireService(db);
}
