import { admin } from '@/lib/firebaseAdmin';

import { FirestoreApplicationAssignmentService } from './FirestoreApplicationAssignmentService';

export function getApplicationAssignmentService(): FirestoreApplicationAssignmentService {
  const db = admin.firestore();
  return new FirestoreApplicationAssignmentService(db);
}
