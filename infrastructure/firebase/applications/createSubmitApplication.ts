import { SubmitApplication } from '@/application/applications/SubmitApplication';
import { logEvent } from '@/infrastructure/observability/logger';
import { admin } from '@/lib/firebaseAdmin';
import { findExistingStorageFile } from '@/lib/storageBucket';
import { resolveOwnedStorageObjectPath } from '@/lib/storageObjectPath';

import { consumeRateLimit } from '../marketplace/consumeRateLimit';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

import {
  FirestoreApplicationSubmissionStore,
  StorageCvSnapshotter,
} from './FirestoreApplicationSubmissionStore';
import type { StorageFileLike } from './FirestoreApplicationSubmissionStore';

let instance: SubmitApplication | null = null;

/**
 * D13: o identificador é um uid (pseudónimo), por isso sem segredo próprio usa
 * uma chave estável do projeto — o objetivo é não expor uids nos ids dos
 * documentos, não proteger um segredo. Falha do limitador não bloqueia a
 * candidatura (D12/K1): regista e deixa passar.
 */
function hashingSecret(): string {
  return (
    process.env.RATE_LIMIT_HASH_SECRET ||
    `empregostp:${process.env.FIREBASE_PROJECT_ID || admin.app()?.options?.projectId || 'local'}`
  );
}

export function getSubmitApplication(): SubmitApplication {
  if (instance) return instance;
  const db = admin.firestore();
  instance = new SubmitApplication(
    new FirestoreFeatureFlags(db),
    new FirestoreApplicationSubmissionStore(db),
    new StorageCvSnapshotter(
      async (path) =>
        (await findExistingStorageFile(
          path,
        )) as unknown as StorageFileLike | null,
      (error) =>
        logEvent(
          'error',
          'application_cv_snapshot_failed',
          { route: '/api/applications', errorCode: 'CV_SNAPSHOT_FAILED' },
          error,
        ),
    ),
    async (userId) => {
      try {
        return (
          await consumeRateLimit(
            db,
            'application_submit',
            { userId },
            hashingSecret(),
          )
        ).allowed;
      } catch (error) {
        logEvent(
          'warn',
          'application_rate_limit_unavailable',
          { route: '/api/applications', errorCode: 'RATE_LIMIT_UNAVAILABLE' },
          error,
        );
        return true;
      }
    },
    (userId, value) =>
      resolveOwnedStorageObjectPath({
        ownerUid: userId,
        prefix: 'cvUrl',
        value,
      }),
  );
  return instance;
}
