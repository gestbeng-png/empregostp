import { SubmitReport } from '@/application/reports/SubmitReport';
import { logEvent } from '@/infrastructure/observability/logger';
import { admin } from '@/lib/firebaseAdmin';

import { consumeRateLimit } from '../marketplace/consumeRateLimit';
import { FirestoreFeatureFlags } from '../marketplace/FirestoreFeatureFlags';

import { FirestoreReportStore } from './FirestoreReportStore';

let instance: SubmitReport | null = null;

export function getSubmitReport(): SubmitReport {
  if (instance) return instance;
  const db = admin.firestore();
  const secret =
    process.env.RATE_LIMIT_HASH_SECRET ||
    `empregostp:${process.env.FIREBASE_PROJECT_ID || admin.app()?.options?.projectId || 'local'}`;
  instance = new SubmitReport(
    new FirestoreFeatureFlags(db),
    new FirestoreReportStore(db),
    async (userId) => {
      try {
        return (await consumeRateLimit(db, 'report_submit', { userId }, secret))
          .allowed;
      } catch (error) {
        // Uma denúncia de fraude nunca se perde por falha do limitador.
        logEvent(
          'warn',
          'report_rate_limit_unavailable',
          { route: '/api/reports', errorCode: 'RATE_LIMIT_UNAVAILABLE' },
          error,
        );
        return true;
      }
    },
  );
  return instance;
}
