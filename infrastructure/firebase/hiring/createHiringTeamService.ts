import { admin } from '@/lib/firebaseAdmin';

import { getFeatureEnvironment } from '../marketplace/environment';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';
import { getTeamService } from '../team/createTeamService';

import { FirestoreHiringTeamService } from './FirestoreHiringTeamService';

let flags: FirestoreFeatureFlags | null = null;

export function getHiringTeamService(): FirestoreHiringTeamService {
  const db = admin.firestore();
  flags ||= new FirestoreFeatureFlags(db);
  return new FirestoreHiringTeamService(
    db,
    flags,
    { environment: getFeatureEnvironment() },
    getTeamService(),
  );
}
