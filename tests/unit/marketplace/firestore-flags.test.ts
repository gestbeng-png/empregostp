import type { Firestore } from 'firebase-admin/firestore';

import { FirestoreFeatureFlags } from '@/infrastructure/firebase/marketplace/FirestoreFeatureFlags';

function store(exists: boolean, data?: unknown): Firestore {
  return {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists, data: () => data }) }),
    }),
  } as unknown as Firestore;
}

test.each([
  'KILL_AI',
  'KILL_WHATSAPP',
  'KILL_OUTBOUND_EMAIL_MARKETING',
] as const)(
  '%s fica ligado (falha fechada) com dados inválidos',
  async (key) => {
    for (const data of [{ enabled: 'false' }, {}, null]) {
      expect(
        await new FirestoreFeatureFlags(store(true, data)).enabled(key),
      ).toBe(true);
    }
    expect(await new FirestoreFeatureFlags(store(false)).enabled(key)).toBe(
      false,
    );
    expect(
      await new FirestoreFeatureFlags(store(true, { enabled: false })).enabled(
        key,
      ),
    ).toBe(false);
    expect(
      await new FirestoreFeatureFlags(store(true, { enabled: true })).enabled(
        key,
      ),
    ).toBe(true);
  },
);

test('Firestore indisponível trava os envios para fora', async () => {
  const db = {
    collection: () => {
      throw new Error('unavailable');
    },
  } as unknown as Firestore;
  expect(await new FirestoreFeatureFlags(db).enabled('KILL_AI')).toBe(true);
});
