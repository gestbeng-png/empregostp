import { OfferStatus } from './states';

/** The timestamp shapes accepted at the domain boundary by Firestore and APIs. */
export type OfferDateValue =
  | Date
  | number
  | string
  | { toDate(): Date }
  | null
  | undefined;

export interface OfferExpiryCandidate {
  id: string;
  status: string;
  expiresAt: OfferDateValue;
}

export interface OfferExpiryItem {
  id: string;
  expiresAt: Date;
}

export interface OfferExpiryPlan {
  due: OfferExpiryItem[];
  ignored: number;
}

function toDate(value: OfferDateValue): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? new Date(date.getTime())
      : null;
  }
  return null;
}

/**
 * Selects only SENT offers whose expiry has been reached.
 *
 * Expiry is inclusive: an offer with expiresAt exactly equal to `now` is due.
 * Non-SENT offers and malformed dates are deliberately ignored so a retrying
 * cron cannot reopen or mutate an already-decided offer.
 */
export function planOfferExpirations(
  offers: readonly OfferExpiryCandidate[],
  now: Date,
): OfferExpiryPlan {
  if (Number.isNaN(now.getTime())) {
    throw new Error('INVALID_NOW');
  }

  const due: OfferExpiryItem[] = [];
  let ignored = 0;
  for (const offer of offers) {
    const expiresAt = toDate(offer.expiresAt);
    if (
      offer.status === OfferStatus.SENT &&
      typeof offer.id === 'string' &&
      offer.id.length > 0 &&
      expiresAt !== null &&
      expiresAt.getTime() <= now.getTime()
    ) {
      due.push({ id: offer.id, expiresAt });
    } else {
      ignored++;
    }
  }
  return { due, ignored };
}
