import { admin } from '@/lib/firebaseAdmin';

import { getTeamService } from '../team/createTeamService';

import { FirestoreHiringTeamService } from './FirestoreHiringTeamService';

export function getHiringTeamService(): FirestoreHiringTeamService {
  const db = admin.firestore();
  return new FirestoreHiringTeamService(db, getTeamService());
}
