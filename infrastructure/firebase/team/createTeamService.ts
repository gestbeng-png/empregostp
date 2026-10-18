import type { NextApiRequest, NextApiResponse } from 'next';

import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';

import { FirestoreTeamService } from './FirestoreTeamService';

export function getTeamService(): FirestoreTeamService {
  const db = admin.firestore();
  return new FirestoreTeamService(db, process.env.TEAM_INVITE_SECRET);
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
