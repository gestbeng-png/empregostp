import { getOperationalAlerts } from '@/application/operations/GetOperationalAlerts';
import { getFeatureEnvironment } from '@/infrastructure/firebase/marketplace/environment';
import {
  createOutboxCronHandler,
  matchesCronSecret,
} from '@/presentation/outbox/createOutboxCronHandler';
import type { OutboxCronRuntime } from '@/presentation/outbox/createOutboxCronHandler';

jest.mock('@/infrastructure/observability/logger', () => ({
  logEvent: jest.fn(),
}));

function response() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}
const batch = { claimed: 2, completed: 2, failed: 0, leaseLost: 0 };
const runtime = (): jest.Mocked<OutboxCronRuntime> => ({
  enabled: jest.fn().mockResolvedValue(true),
  process: jest.fn().mockResolvedValue(batch),
  heartbeat: jest.fn().mockResolvedValue(undefined),
});

describe('Cron do outbox: secret, arm, flags, heartbeat', () => {
  test('constant-time comparison denies missing, malformed and mismatched secrets', () => {
    expect(matchesCronSecret(undefined, 'secret')).toBe(false);
    expect(matchesCronSecret('Bearer secret', undefined)).toBe(false);
    expect(matchesCronSecret('Basic secret', 'secret')).toBe(false);
    expect(matchesCronSecret('Bearer wrong!', 'secret')).toBe(false);
    expect(matchesCronSecret('Bearer secret', 'secret')).toBe(true);
  });
  test('unauthorized, method and default disarm do not construct Firebase runtime', async () => {
    const factory = jest.fn(runtime);
    for (const [method, auth, armed, status] of [
      ['GET', undefined, true, 401],
      ['DELETE', 'Bearer secret', true, 405],
      ['POST', 'Bearer secret', false, 200],
    ] as const) {
      const res = response();
      await createOutboxCronHandler(factory, {
        secret: () => 'secret',
        armed: () => armed,
      })({ method, headers: { authorization: auth } } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(status);
    }
    expect(factory).not.toHaveBeenCalled();
  });
  test('all flags off keeps queue and heartbeat untouched', async () => {
    const runner = runtime();
    runner.enabled.mockResolvedValue(false);
    const res = response();
    await createOutboxCronHandler(() => runner, {
      secret: () => 'secret',
      armed: () => true,
    })(
      { method: 'GET', headers: { authorization: 'Bearer secret' } } as never,
      res as never,
    );
    expect(res.json).toHaveBeenCalledWith({ status: 'disabled' });
    expect(runner.process).not.toHaveBeenCalled();
    expect(runner.heartbeat).not.toHaveBeenCalled();
  });
  test('success records heartbeat; exceptions expose only a stable code', async () => {
    const runner = runtime();
    const res = response();
    const handler = createOutboxCronHandler(() => runner, {
      secret: () => 'secret',
      armed: () => true,
      now: () => 1000,
    });
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    } as never;
    await handler(req, res as never);
    expect(runner.heartbeat).toHaveBeenCalledWith(1000, 0, batch);
    expect(res.json).toHaveBeenCalledWith({ status: 'processed', ...batch });
    runner.process.mockRejectedValue(new Error('private@example.test'));
    await handler(req, res as never);
    expect(res.status).toHaveBeenLastCalledWith(503);
    expect(res.json).toHaveBeenLastCalledWith({ code: 'OUTBOX_UNAVAILABLE' });
  });
  test('alerts are meaningful only when the cron is expected to run', () => {
    const snap = { oldestDueAgeMs: 0, dead: 0, lastOutboxRunAtMs: null };
    expect(getOperationalAlerts(snap, 1000, false)).toEqual([]);
    expect(
      getOperationalAlerts(
        { ...snap, oldestDueAgeMs: 900_001, dead: 1 },
        1000,
        true,
      ).map((alert) => alert.code),
    ).toEqual(['OUTBOX_OVERDUE', 'OUTBOX_DEAD_LETTERS', 'OUTBOX_CRON_STALE']);
    expect(
      getOperationalAlerts({ ...snap, lastOutboxRunAtMs: 0 }, 7_200_000, true),
    ).toEqual([]);
    expect(
      getOperationalAlerts({ ...snap, lastOutboxRunAtMs: 0 }, 7_200_001, true),
    ).toHaveLength(1);
  });
  test('30-minute schedule has grace before reporting a normal queued event as overdue', () => {
    const snapshot = {
      oldestDueAgeMs: 1_800_000,
      dead: 0,
      lastOutboxRunAtMs: 1000,
    };
    expect(getOperationalAlerts(snapshot, 1000, true, 2_700_000)).toEqual([]);
    expect(
      getOperationalAlerts(
        { ...snapshot, oldestDueAgeMs: 2_700_001 },
        1000,
        true,
        2_700_000,
      ),
    ).toEqual([{ code: 'OUTBOX_OVERDUE', severity: 'warning' }]);
  });
  test('self-hosted production never inherits staging flags', () => {
    expect(getFeatureEnvironment({ NODE_ENV: 'production' })).toBe(
      'production',
    );
    expect(
      getFeatureEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }),
    ).toBe('staging');
    expect(
      getFeatureEnvironment({
        NODE_ENV: 'development',
        VERCEL_ENV: 'production',
      }),
    ).toBe('production');
    expect(getFeatureEnvironment({ NODE_ENV: 'development' })).toBe(
      'development',
    );
  });
});
