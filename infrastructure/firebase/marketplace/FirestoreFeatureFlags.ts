import type { Firestore } from 'firebase-admin/firestore';

import type { FeatureFlagReader } from '@/application/marketplace/ports';
import { DEFAULT_FLAGS, isEnabled } from '@/domain/feature-flags/flags';
import type { FeatureFlag, FeatureKey } from '@/domain/feature-flags/flags';

/** Interruptores de emergência guardados em `featureFlags/<KILL_*>`. */
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

  async enabled(key: FeatureKey): Promise<boolean> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) return isEnabled(cached.value);
    try {
      const snapshot = await this.db.collection('featureFlags').doc(key).get();
      const data = snapshot.data();
      // Um interruptor guardado mas inválido trava os efeitos para fora em
      // vez de os deixar passar em silêncio.
      const value: FeatureFlag =
        data && typeof data.enabled === 'boolean'
          ? { enabled: data.enabled }
          : snapshot.exists
            ? { enabled: true }
            : DEFAULT_FLAGS[key];
      this.cache.set(key, { value, expiresAt: this.now() + 60_000 });
      return isEnabled(value);
    } catch {
      // Configuração indisponível: falha fechado — os interruptores ficam
      // ligados e nada sai (IA, WhatsApp, email de marketing).
      return true;
    }
  }
}
