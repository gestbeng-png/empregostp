import type { Firestore } from 'firebase-admin/firestore';

import type { HealthProbe } from '@/application/health/CheckHealth';

export class FirestoreHealthProbe implements HealthProbe {
  constructor(
    private readonly db: Firestore,
    private readonly bucketExists: () => Promise<boolean>,
    private readonly now: () => number = Date.now,
  ) {}
  async database(): Promise<boolean> {
    await this.db.collection('featureFlags').doc('KILL_AI').get();
    return true;
  }
  async storage(): Promise<boolean> {
    return this.bucketExists();
  }
  async queue(): Promise<{ oldestDueAgeMs: number; dead: number }> {
    const now = this.now();
    const [pending, processing, dead] = await Promise.all([
      this.db
        .collection('outboxEvents')
        .where('status', 'in', ['PENDING', 'FAILED'])
        .where('nextAttemptAtMs', '<=', now)
        .orderBy('nextAttemptAtMs')
        .limit(1)
        .get(),
      this.db
        .collection('outboxEvents')
        .where('status', '==', 'PROCESSING')
        .orderBy('leaseUntilMs')
        .limit(1)
        .get(),
      this.db
        .collection('outboxEvents')
        .where('status', '==', 'DEAD')
        .count()
        .get(),
    ]);
    const due = Math.max(
      0,
      now - Number(pending.docs[0]?.data().nextAttemptAtMs ?? now),
    );
    const abandoned = Math.max(
      0,
      now - Number(processing.docs[0]?.data().leaseUntilMs ?? now),
    );
    return {
      oldestDueAgeMs: Math.max(due, abandoned),
      dead: dead.data().count,
    };
  }
}
