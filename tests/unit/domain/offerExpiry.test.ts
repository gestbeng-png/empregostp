import { planOfferExpirations } from '@/domain/offers/expiry';

const now = new Date('2026-10-10T12:00:00.000Z');

describe('offer expiry planning', () => {
  test('selects expired SENT offers, including the exact expiry instant', () => {
    const firestoreTimestamp = { toDate: () => new Date('2026-10-10T11:00:00.000Z') };
    const result = planOfferExpirations(
      [
        { id: 'expired-string', status: 'SENT', expiresAt: '2026-10-10T11:59:59Z' },
        { id: 'expired-timestamp', status: 'SENT', expiresAt: firestoreTimestamp },
        { id: 'expires-now', status: 'SENT', expiresAt: now },
      ],
      now,
    );

    expect(result.due.map((item) => item.id)).toEqual([
      'expired-string',
      'expired-timestamp',
      'expires-now',
    ]);
    expect(result.ignored).toBe(0);
  });

  test('does not expire future, non-SENT, malformed, or blank offers', () => {
    const result = planOfferExpirations(
      [
        { id: 'future', status: 'SENT', expiresAt: '2026-10-10T12:00:01Z' },
        { id: 'accepted', status: 'ACCEPTED', expiresAt: '2026-10-10T11:00:00Z' },
        { id: 'invalid-date', status: 'SENT', expiresAt: 'not-a-date' },
        { id: '', status: 'SENT', expiresAt: '2026-10-10T11:00:00Z' },
      ],
      now,
    );

    expect(result).toEqual({ due: [], ignored: 4 });
  });

  test('returns defensive Date values and rejects an invalid clock', () => {
    const expiresAt = new Date('2026-10-10T11:00:00Z');
    const result = planOfferExpirations(
      [{ id: 'offer-1', status: 'SENT', expiresAt }],
      now,
    );

    expect(result.due[0]?.expiresAt).not.toBe(expiresAt);
    expect(result.due[0]?.expiresAt).toEqual(expiresAt);
    expect(() => planOfferExpirations([], new Date('invalid'))).toThrow(
      'INVALID_NOW',
    );
  });
});
