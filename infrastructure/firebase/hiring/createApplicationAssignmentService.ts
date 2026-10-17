import { admin } from '@/lib/firebaseAdmin';

import { getFeatureEnvironment } from '../marketplace/environment';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

import { FirestoreApplicationAssignmentService } from './FirestoreApplicationAssignmentService';

let flags: FirestoreFeatureFlags | null = null;

export function getApplicationAssignmentService(): FirestoreApplicationAssignmentService {
  const db = admin.firestore();
  flags ||= new FirestoreFeatureFlags(db);
  return new FirestoreApplicationAssignmentService(db, flags, {
    environment: getFeatureEnvironment(),
  });
}
