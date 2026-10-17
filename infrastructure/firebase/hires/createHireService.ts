import { admin } from '@/lib/firebaseAdmin';

import { getFeatureEnvironment } from '../marketplace/environment';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

import { FirestoreHireService } from './FirestoreHireService';

let flags: FirestoreFeatureFlags | null = null;

export function getHireService(): FirestoreHireService {
  const db = admin.firestore();
  flags ||= new FirestoreFeatureFlags(db);
  return new FirestoreHireService(db, flags, {
    environment: getFeatureEnvironment(),
  });
}
