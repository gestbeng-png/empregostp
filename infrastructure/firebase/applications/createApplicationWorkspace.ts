import type { NextApiRequest, NextApiResponse } from 'next';

import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';
import { findExistingStorageFile } from '@/lib/storageBucket';

import { FirestoreApplicationWorkspace } from './FirestoreApplicationWorkspace';
import { FirestoreBulkActionService } from './FirestoreBulkActionService';

export function getApplicationWorkspace(): FirestoreApplicationWorkspace {
  const db = admin.firestore();
  return new FirestoreApplicationWorkspace(db);
}

export async function authenticateApiUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ uid: string } | null> {
  const result = await requireActiveApiUser(req, res, { adminApp: admin });
  return result ? { uid: result.uid } : null;
}

export async function signSnapshotFile(
  objectPath: string,
  expiresAtMs: number,
): Promise<string | null> {
  const file = (await findExistingStorageFile(objectPath)) as {
    getSignedUrl: (options: {
      action: 'read';
      expires: number;
    }) => Promise<[string]>;
  } | null;
  if (!file) return null;
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: expiresAtMs,
  });
  return url;
}

export function getBulkActionService(): FirestoreBulkActionService {
  const db = admin.firestore();
  return new FirestoreBulkActionService(db);
}
