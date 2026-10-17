import { admin } from '@/lib/firebaseAdmin';

import { getFeatureEnvironment } from '../marketplace/environment';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

import { FirestoreInterviewService } from './FirestoreInterviewService';

let flags: FirestoreFeatureFlags | null = null;

export function getInterviewService(): FirestoreInterviewService {
  const db = admin.firestore();
  flags ||= new FirestoreFeatureFlags(db);
  return new FirestoreInterviewService(db, flags, {
    environment: getFeatureEnvironment(),
  });
}
