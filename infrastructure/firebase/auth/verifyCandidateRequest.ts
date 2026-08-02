import type { NextApiRequest } from 'next';

import { toUserId, type UserId } from '@/domain/shared/brand';
import { ApplicationError } from '@/domain/shared/errors';
import { getAdminAuth } from '@/infrastructure/firebase/admin';

export async function verifyCandidateRequest(
  request: NextApiRequest,
): Promise<UserId> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApplicationError(
      'unauthorized',
      'A sessão terminou. Inicie sessão novamente.',
    );
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new ApplicationError(
      'unauthorized',
      'A sessão terminou. Inicie sessão novamente.',
    );
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    return toUserId(decodedToken.uid);
  } catch (error) {
    throw new ApplicationError(
      'unauthorized',
      'A sessão terminou. Inicie sessão novamente.',
      { cause: error },
    );
  }
}
