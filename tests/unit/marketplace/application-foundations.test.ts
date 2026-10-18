import { checkHealth } from '@/application/health/CheckHealth';
import type { HealthProbe } from '@/application/health/CheckHealth';
import type {
  TransitionCommand,
  TransitionPolicy,
} from '@/application/marketplace/ports';
import { TransitionEntity } from '@/application/marketplace/TransitionEntity';
import { ProcessOutbox } from '@/application/outbox/ProcessOutbox';
import type {
  EventHandler,
  OutboxStore,
} from '@/application/outbox/ProcessOutbox';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';
import { failure, success } from '@/domain/shared/Result';
import { logEvent } from '@/infrastructure/observability/logger';

const event: OutboxEvent = {
  id: 'event-a',
  type: 'entity_status_changed',
  schemaVersion: 1,
  payload: { entityId: 'job-a', entityKind: 'Job', version: 1 },
  status: 'PROCESSING',
  attempts: 0,
  createdAtMs: 0,
  nextAttemptAtMs: 0,
};
const createStore = (): jest.Mocked<OutboxStore> => ({
  due: jest.fn().mockResolvedValue([event.id]),
  claim: jest.fn().mockResolvedValue(event),
  delivered: jest.fn().mockResolvedValue(false),
  markDelivered: jest.fn().mockResolvedValue(true),
  finish: jest.fn().mockResolvedValue(true),
  fail: jest.fn().mockResolvedValue(true),
});
const handler = (changes: Partial<EventHandler> = {}): EventHandler => ({
  name: 'test_handler',
  eventTypes: [event.type],
  deliver: jest.fn().mockResolvedValue(undefined),
  ...changes,
});

describe('TransitionEntity', () => {
  const command: TransitionCommand = {
    kind: 'Job',
    entityId: 'job-a',
    actorUserId: 'user-a',
    to: 'PAUSED',
    expectedVersion: 0,
    idempotencyKey: 'synthetic-key-0001',
  };
  test('delegates the transition to the store with the use-case policy', async () => {
    const policy: TransitionPolicy = jest.fn().mockResolvedValue(success({}));
    const store = { transition: jest.fn().mockResolvedValue(success({})) };
    await new TransitionEntity(store, policy).execute(command);
    expect(store.transition).toHaveBeenCalledWith(command, policy);
  });
  test('domain result defaults use centralized Portuguese messages', () =>
    expect(failure('FORBIDDEN')).toMatchObject({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Não tem permissão para esta operação.',
      },
    }));
});
describe('Outbox delivery, retries, kills and lease fencing', () => {
  test('completed delivery is idempotent; previous handler receipts are skipped', async () => {
    const store = createStore();
    const one = handler();
    const two = handler({ name: 'another_handler' });
    store.delivered.mockImplementation(
      async (_id, name) => name === 'test_handler',
    );
    const result = await new ProcessOutbox(
      store,
      [one, two],
      { enabled: async () => false },
      () => 'lease-a',
      () => 1000,
    ).execute(500);
    expect(result).toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
      leaseLost: 0,
    });
    expect(store.due).toHaveBeenCalledWith(1000, 100);
    expect(one.deliver).not.toHaveBeenCalled();
    expect(two.deliver).toHaveBeenCalledWith(event, 'event-a:another_handler');
  });
  test('channel failure does not throw or lose successful earlier delivery', async () => {
    const store = createStore();
    const one = handler();
    const two = handler({
      name: 'failing_handler',
      deliver: jest.fn().mockRejectedValue(new Error('private@example.test')),
    });
    const result = await new ProcessOutbox(
      store,
      [one, two],
      { enabled: async () => false },
      () => 'lease-a',
      () => 1000,
    ).execute();
    expect(result.failed).toBe(1);
    expect(store.markDelivered).toHaveBeenCalledWith(
      event.id,
      one.name,
      'lease-a',
      1000,
    );
    expect(store.fail).toHaveBeenCalledWith(
      event.id,
      'lease-a',
      1000,
      'HANDLER_FAILED',
    );
    expect(store.finish).not.toHaveBeenCalled();
  });
  test.each(['AI', 'WHATSAPP', 'EMAIL_MARKETING'] as const)(
    '%s kill checked before effect, leaves retry pending',
    async (channel) => {
      const store = createStore();
      const outbound = handler({ channel });
      const flags = { enabled: jest.fn().mockResolvedValue(true) };
      expect(
        (
          await new ProcessOutbox(
            store,
            [outbound],
            flags,
            () => 'lease-a',
            () => 1000,
          ).execute()
        ).failed,
      ).toBe(1);
      expect(outbound.deliver).not.toHaveBeenCalled();
      expect(store.fail).toHaveBeenCalledWith(
        event.id,
        'lease-a',
        1000,
        'CHANNEL_DISABLED',
      );
    },
  );
  test('unknown/malformed event fails closed, no silent DONE', async () => {
    for (const bad of [
      event,
      { ...event, payload: { email: 'synthetic@example.test' } },
      { ...event, schemaVersion: 2 },
    ]) {
      const store = createStore();
      store.claim.mockResolvedValue(bad as OutboxEvent);
      expect(
        (
          await new ProcessOutbox(
            store,
            [],
            { enabled: async () => false },
            () => 'lease-a',
          ).execute()
        ).failed,
      ).toBe(1);
      expect(store.finish).not.toHaveBeenCalled();
    }
  });
  test('claim lost and receipt fence prevent stale worker settlement', async () => {
    const store = createStore();
    store.claim.mockResolvedValueOnce(undefined);
    expect(
      (
        await new ProcessOutbox(
          store,
          [handler()],
          { enabled: async () => false },
          () => 'lease-a',
        ).execute()
      ).claimed,
    ).toBe(0);
    store.markDelivered.mockResolvedValue(false);
    expect(
      (
        await new ProcessOutbox(
          store,
          [handler()],
          { enabled: async () => false },
          () => 'lease-a',
        ).execute()
      ).leaseLost,
    ).toBe(1);
    expect(store.finish).not.toHaveBeenCalled();
    store.markDelivered.mockResolvedValue(true);
    store.finish.mockResolvedValue(false);
    expect(
      (
        await new ProcessOutbox(
          store,
          [handler()],
          { enabled: async () => false },
          () => 'lease-a',
        ).execute()
      ).leaseLost,
    ).toBe(1);
    store.fail.mockResolvedValue(false);
    expect(
      (
        await new ProcessOutbox(
          store,
          [],
          { enabled: async () => false },
          () => 'lease-a',
        ).execute()
      ).leaseLost,
    ).toBe(1);
  });
  test('handler names unique and safe', () => {
    const store = createStore();
    expect(
      () =>
        new ProcessOutbox(
          store,
          [handler(), handler()],
          { enabled: async () => false },
          () => 'lease',
        ),
    ).toThrow('INVALID_HANDLER_REGISTRY');
    expect(
      () =>
        new ProcessOutbox(
          store,
          [handler({ name: 'email@example.test' })],
          { enabled: async () => false },
          () => 'lease',
        ),
    ).toThrow('INVALID_HANDLER_REGISTRY');
  });
});
describe('Health and privacy-safe logging', () => {
  const probe = (): HealthProbe => ({
    database: async () => true,
    storage: async () => true,
    queue: async () => ({ oldestDueAgeMs: 0, dead: 0 }),
  });
  test('healthy, channel down, overdue queue, dead letters and DB exception', async () => {
    expect((await checkHealth(probe())).status).toBe('ok');
    expect(
      (await checkHealth({ ...probe(), storage: async () => false })).status,
    ).toBe('degraded');
    expect(
      (
        await checkHealth({
          ...probe(),
          queue: async () => ({ oldestDueAgeMs: 900_001, dead: 0 }),
        })
      ).status,
    ).toBe('degraded');
    expect(
      (
        await checkHealth({
          ...probe(),
          queue: async () => ({ oldestDueAgeMs: 0, dead: 1 }),
        })
      ).status,
    ).toBe('degraded');
    const report = await checkHealth({
      ...probe(),
      database: async () => {
        throw new Error('secret');
      },
    });
    expect(report.status).toBe('degraded');
    expect(JSON.stringify(report)).not.toContain('secret');
    expect(
      (
        await checkHealth(
          { ...probe(), database: () => new Promise(() => undefined) },
          5,
        )
      ).status,
    ).toBe('degraded');
  });
  test('logger hashes uid, allowlists context and drops raw errors/PII', () => {
    const lines: string[] = [];
    logEvent(
      'error',
      'entity_transition_failed',
      {
        requestId: 'req-a',
        userId: 'private@example.test',
        orgId: 'org-a',
        route: '/api/jobs/[id]',
        durationMs: 20,
        errorCode: 'VERSION_CONFLICT',
      },
      Object.assign(new Error('secret CV'), { code: 'storage/test' }),
      (line) => {
        lines.push(line);
      },
    );
    expect(JSON.parse(lines[0] || '{}')).toMatchObject({
      level: 'error',
      msg: 'entity_transition_failed',
      userId: expect.stringMatching(/^[a-f0-9]{64}$/),
      errorCategory: 'storage',
    });
    expect(lines.join('')).not.toMatch(/private@|secret CV/);
    logEvent(
      'info',
      'private@example.test',
      {
        requestId: 'bad@example.test',
        orgId: 'bad@example.test',
        route: '/?email=bad@example.test',
        durationMs: NaN,
        errorCode: 'bad@example.test',
      },
      undefined,
      (line) => {
        lines.push(line);
      },
    );
    expect(JSON.parse(lines[1] || '{}')).toEqual({
      level: 'info',
      msg: 'unclassified_event',
    });
  });
});
