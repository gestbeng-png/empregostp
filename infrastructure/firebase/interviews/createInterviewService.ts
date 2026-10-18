import { admin } from '@/lib/firebaseAdmin';

import { FirestoreInterviewService } from './FirestoreInterviewService';

export function getInterviewService(): FirestoreInterviewService {
  const db = admin.firestore();
  return new FirestoreInterviewService(db);
}
