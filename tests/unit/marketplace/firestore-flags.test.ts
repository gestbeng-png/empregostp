import type { Firestore } from 'firebase-admin/firestore';

import { FirestoreFeatureFlags } from '@/infrastructure/firebase/marketplace/FirestoreFeatureFlags';

function store(exists: boolean, data?: unknown): Firestore {
  return {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists, data: () => data }) }),
    }),
  } as unknown as Firestore;
}
const context = { environment: 'production' as const };
test.each([
  'KILL_AI',
  'KILL_WHATSAPP',
  'KILL_OUTBOUND_EMAIL_MARKETING',
] as const)('%s fails closed for malformed persisted data', async (key) => {
  for (const data of [
    { enabled: 'false' },
    { enabled: false, rolloutPercent: -1 },
    { enabled: false, allowOrgIds: [123] },
  ]) {
    expect(
      await new FirestoreFeatureFlags(store(true, data)).enabled(key, context),
    ).toBe(true);
  }
  expect(
    await new FirestoreFeatureFlags(store(false)).enabled(key, context),
  ).toBe(false);
  expect(
    await new FirestoreFeatureFlags(store(true, { enabled: false })).enabled(
      key,
      context,
    ),
  ).toBe(false);
});
test('malformed feature cannot turn on; unavailable store stops outbound without enabling features', async () => {
  expect(
    await new FirestoreFeatureFlags(store(true, { enabled: 'true' })).enabled(
      'V2_JOB_LIFECYCLE',
      context,
    ),
  ).toBe(false);
  const db = {
    collection: () => {
      throw new Error('unavailable');
    },
  } as unknown as Firestore;
  expect(await new FirestoreFeatureFlags(db).enabled('KILL_AI', context)).toBe(
    true,
  );
  expect(
    await new FirestoreFeatureFlags(db).enabled('V2_JOB_LIFECYCLE', context),
  ).toBe(false);
});
