import { admin } from '@/lib/firebaseAdmin';

import { getTeamService } from '../team/createTeamService';

import { FirestoreMemberOffboardingService } from './FirestoreMemberOffboardingService';

export function getMemberOffboardingService(): FirestoreMemberOffboardingService {
  return new FirestoreMemberOffboardingService(
    admin.firestore(),
    getTeamService(),
  );
}
