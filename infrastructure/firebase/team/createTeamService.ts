import type { NextApiRequest, NextApiResponse } from 'next';

import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';

import { getFeatureEnvironment } from '../marketplace/environment';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

import { FirestoreTeamService } from './FirestoreTeamService';

let flags: FirestoreFeatureFlags | null = null;

export function getTeamService(): FirestoreTeamService {
  const db = admin.firestore();
  flags ||= new FirestoreFeatureFlags(db);
  return new FirestoreTeamService(
    db,
    flags,
    { environment: getFeatureEnvironment() },
    process.env.TEAM_INVITE_SECRET,
  );
}

/** Sessão com email verificado (o aceite de convite compara o email, E12). */
export async function authenticateWithEmail(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{
  uid: string;
  email: string | null;
  emailVerified: boolean;
} | null> {
  const result = await requireActiveApiUser(req, res, { adminApp: admin });
  if (!result) return null;
  return {
    uid: result.uid,
    email:
      typeof result.decodedToken?.email === 'string'
        ? result.decodedToken.email
        : null,
    emailVerified: result.decodedToken?.email_verified === true,
  };
}
