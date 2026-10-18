import type { SystemLifecycleStore } from '@/application/marketplace/ports';
import { planOfferExpirations } from '@/domain/offers/expiry';
import type { OfferDateValue } from '@/domain/offers/expiry';
import { failure, success } from '@/domain/shared/Result';

export interface ExpiryOffer {
  id: string;
  organizationId: string;
  version: number;
  expiresAt: OfferDateValue;
}

/** Cada transição relê prazo, estado e organização dentro da transação. */
export class ExpireOffers {
  constructor(
    private readonly store: SystemLifecycleStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    offers: readonly ExpiryOffer[],
  ): Promise<{ expired: number; skipped: number; failed: number }> {
    const result = { expired: 0, skipped: 0, failed: 0 };
    for (const offer of offers) {
      if (
        !offer.organizationId ||
        !Number.isSafeInteger(offer.version) ||
        offer.version < 0 ||
        !planOfferExpirations([{ ...offer, status: 'SENT' }], this.clock()).due
          .length
      ) {
        result.skipped++;
        continue;
      }
      const outcome = await this.store.transitionAsSystem(
        {
          kind: 'Offer',
          entityId: offer.id,
          to: 'EXPIRED',
          expectedVersion: offer.version,
          systemJob: 'expireOffers',
          idempotencyKey: `offer_expiry_version_${offer.version}`,
        },
        async (record) => {
          if (
            record.organizationId !== offer.organizationId ||
            record.v2Status !== 'SENT'
          )
            return failure('FEATURE_DISABLED');
          const due =
            planOfferExpirations(
              [
                {
                  id: record.id,
                  status: record.v2Status,
                  expiresAt: record.facts.expiresAt as OfferDateValue,
                },
              ],
              this.clock(),
            ).due.length > 0;
          return success({ guards: { hasExpired: due } });
        },
      );
      if (outcome.ok) result.expired++;
      else if (
        ['VERSION_CONFLICT', 'FEATURE_DISABLED', 'NOT_FOUND'].includes(
          outcome.error.code,
        )
      )
        result.skipped++;
      else result.failed++;
    }
    return result;
  }
}
