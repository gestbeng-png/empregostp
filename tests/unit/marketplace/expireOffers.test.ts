import type {
  LifecycleRecord,
  SystemLifecycleStore,
} from '@/application/marketplace/ports';
import { ExpireOffers } from '@/application/offers/ExpireOffers';
import { failure, success } from '@/domain/shared/Result';

const now = new Date('2026-10-10T12:00:00Z');
const offer = {
  id: 'offer-1',
  organizationId: 'org-1',
  version: 2,
  expiresAt: now,
};
const context = { environment: 'development' as const };
const record: LifecycleRecord = {
  id: offer.id,
  kind: 'Offer',
  organizationId: offer.organizationId,
  version: 2,
  v2Status: 'SENT',
  facts: { expiresAt: now },
};
const actor = {
  permission: {
    userId: 'system:expireOffers',
    platformRole: 'NONE',
    active: true,
  },
  transition: 'SYSTEM',
} as const;

test('flag desligada e prazo futuro não chamam o store', async () => {
  const store = { transitionAsSystem: jest.fn() };
  expect(
    await new ExpireOffers(
      { enabled: async () => false },
      store,
      () => now,
    ).execute([offer], context),
  ).toEqual({ expired: 0, skipped: 1, failed: 0 });
  await new ExpireOffers(
    { enabled: async () => true },
    store,
    () => now,
  ).execute([{ ...offer, expiresAt: new Date(now.getTime() + 1) }], context);
  expect(store.transitionAsSystem).not.toHaveBeenCalled();
});

test.each([
  ['SENT', now, true],
  ['ACCEPTED', now, false],
  ['SENT', new Date(now.getTime() + 1), false],
])(
  'relê estado %s e prazo dentro da transação',
  async (status, deadline, expected) => {
    const store: SystemLifecycleStore = {
      transitionAsSystem: async (command, policy) => {
        expect(command).toMatchObject({
          to: 'EXPIRED',
          expectedVersion: 2,
          systemJob: 'expireOffers',
        });
        const guard = await policy(
          { ...record, v2Status: status, facts: { expiresAt: deadline } },
          actor as never,
        );
        expect(guard.ok && guard.value.guards?.hasExpired === true).toBe(
          expected,
        );
        return failure('VERSION_CONFLICT');
      },
    };
    await new ExpireOffers(
      { enabled: async () => true },
      store,
      () => now,
    ).execute([offer], context);
  },
);

test('contabiliza sucesso e conflito sem repetir respostas do candidato', async () => {
  const store = {
    transitionAsSystem: jest
      .fn()
      .mockResolvedValueOnce(
        success({
          entityId: 'offer-1',
          status: 'EXPIRED',
          version: 3,
          eventId: 'event-1',
        }),
      )
      .mockResolvedValueOnce(failure('VERSION_CONFLICT')),
  };
  const run = new ExpireOffers({ enabled: async () => true }, store, () => now);
  expect(await run.execute([offer, offer], context)).toEqual({
    expired: 1,
    skipped: 1,
    failed: 0,
  });
});
