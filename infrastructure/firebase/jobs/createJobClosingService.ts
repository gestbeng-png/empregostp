import { admin } from '@/lib/firebaseAdmin';

import { getFeatureEnvironment } from '../marketplace/environment';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

import { FirestoreJobClosingService } from './FirestoreJobClosingService';

let flags: FirestoreFeatureFlags | null = null;

export function getJobClosingService(): FirestoreJobClosingService {
  const db = admin.firestore();
  flags ||= new FirestoreFeatureFlags(db);
  return new FirestoreJobClosingService(db, flags, {
    environment: getFeatureEnvironment(),
  });
}
