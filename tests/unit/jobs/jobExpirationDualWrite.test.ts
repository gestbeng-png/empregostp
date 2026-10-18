import { buildExpiredJobUpdate, buildExpiryHistory } from '@/lib/jobExpiration';

const admin = {
  firestore: { FieldValue: { serverTimestamp: () => 'TS' } },
} as unknown as Parameters<typeof buildExpiredJobUpdate>[0];
const now = new Date('2026-10-10T02:15:00Z');

describe('D7/F2.8 — expiração com escrita dupla', () => {
  test('sem dados da vaga: exatamente o update legado anterior', () => {
    expect(buildExpiredJobUpdate(admin, now)).toEqual({
      status: 'closed',
      destaque: false,
      closedAutomatically: true,
      closedReason: 'expired',
      closedAt: 'TS',
      expiredAt: now.toISOString(),
      updatedAt: 'TS',
    });
  });

  test('vaga legada: marca o fim (F2.8) sem criar v2Status', () => {
    const update = buildExpiredJobUpdate(admin, now, { status: 'active' });
    expect(update).toMatchObject({
      status: 'closed',
      jobEndState: 'EXPIRED',
      jobEndPending: true,
      jobEndedAt: now.toISOString(),
    });
    expect(update).not.toHaveProperty('v2Status');
    expect(
      buildExpiryHistory('j1', { status: 'active' }, update, now),
    ).toBeNull();
  });

  test('vaga v2 publicada: EXPIRED, versão +1 e histórico SYSTEM', () => {
    const job = { status: 'active', v2Status: 'PUBLISHED', version: 4 };
    const update = buildExpiredJobUpdate(admin, now, job);
    expect(update).toMatchObject({
      v2Status: 'EXPIRED',
      version: 5,
      status: 'closed',
    });
    expect(buildExpiryHistory('j1', job, update, now)).toEqual({
      entityId: 'j1',
      from: 'PUBLISHED',
      to: 'EXPIRED',
      actorId: 'system:expireJobs',
      actorType: 'SYSTEM',
      reason: 'DEADLINE_PASSED',
      at: now,
      version: 5,
    });
  });

  test('vaga v2 pausada não passa a EXPIRED (E3: só PUBLISHED expira)', () => {
    const update = buildExpiredJobUpdate(admin, now, {
      v2Status: 'PAUSED',
      version: 2,
    });
    expect(update).not.toHaveProperty('v2Status');
  });
});
