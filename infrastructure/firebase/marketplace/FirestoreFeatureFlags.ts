import type { Firestore } from 'firebase-admin/firestore';

import type { FeatureFlagReader } from '@/application/marketplace/ports';
import { DEFAULT_FLAGS, isEnabled } from '@/domain/feature-flags/flags';
import type {
  FeatureContext,
  FeatureFlag,
  FeatureKey,
} from '@/domain/feature-flags/flags';

export class FirestoreFeatureFlags implements FeatureFlagReader {
  private readonly cache = new Map<
    FeatureKey,
    { value: FeatureFlag; expiresAt: number }
  >();
  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  invalidate(key?: FeatureKey): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  async enabled(key: FeatureKey, context: FeatureContext): Promise<boolean> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now())
      return isEnabled(key, cached.value, context);
    try {
      const snapshot = await this.db.collection('featureFlags').doc(key).get();
      const data = snapshot.data();
      // Missing flags keep the specified default off. Invalid persisted
      // emergency switches must stop outbound effects, not silently allow them.
      const value: FeatureFlag =
        data &&
        typeof data.enabled === 'boolean' &&
        (data.rolloutPercent === undefined ||
          (typeof data.rolloutPercent === 'number' &&
            Number.isFinite(data.rolloutPercent) &&
            data.rolloutPercent >= 0 &&
            data.rolloutPercent <= 100)) &&
        ['allowOrgIds', 'allowUserIds', 'environments'].every(
          (field) =>
            data[field] === undefined ||
            (Array.isArray(data[field]) &&
              data[field].every((item: unknown) => typeof item === 'string')),
        )
          ? (data as FeatureFlag)
          : snapshot.exists && key.startsWith('KILL_')
            ? { enabled: true }
            : DEFAULT_FLAGS[key];
      this.cache.set(key, { value, expiresAt: this.now() + 60_000 });
      return isEnabled(key, value, context);
    } catch {
      // Fail closed: unavailable config stops new features and all outbound
      // AI/WhatsApp/marketing. Never reuse an expired "on" value.
      return key.startsWith('KILL_');
    }
  }
}
