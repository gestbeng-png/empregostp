import type { HealthProbe } from '@/application/health/CheckHealth';
import { checkHealth } from '@/application/health/CheckHealth';
import { logEvent } from '@/infrastructure/observability/logger';
import { createHealthHandler } from '@/presentation/health/createHealthHandler';

interface MockResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

function createResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 0,
    body: undefined,
    headers: {},
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  response.setHeader.mockImplementation((key: string, value: string) => {
    response.headers[key] = value;
  });
  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  response.json.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });
  return response;
}

function probe(overrides: Partial<HealthProbe> = {}): HealthProbe {
  return {
    database: async () => true,
    storage: async () => true,
    queue: async () => ({ oldestDueAgeMs: 0, dead: 0 }),
    ...overrides,
  };
}

describe('checkHealth (D11)', () => {
  it('ok quando base de dados, storage e fila estão saudáveis', async () => {
    await expect(checkHealth(probe())).resolves.toEqual({
      status: 'ok',
      checks: { database: true, storage: true, queue: true },
      oldestDueAgeMs: 0,
      dead: 0,
    });
  });

  it('degradado quando a fila tem eventos atrasados mais de 15 minutos', async () => {
    const report = await checkHealth(
      probe({ queue: async () => ({ oldestDueAgeMs: 900_001, dead: 0 }) }),
    );
    expect(report.status).toBe('degraded');
    expect(report.checks.queue).toBe(false);

    const limite = await checkHealth(
      probe({ queue: async () => ({ oldestDueAgeMs: 900_000, dead: 0 }) }),
    );
    expect(limite.checks.queue).toBe(true);
  });

  it('degradado quando há eventos em dead letter', async () => {
    const report = await checkHealth(
      probe({ queue: async () => ({ oldestDueAgeMs: 0, dead: 1 }) }),
    );
    expect(report.checks.queue).toBe(false);
  });

  it('uma dependência que rebenta ou não responde conta como falha', async () => {
    jest.useFakeTimers();
    const pending = checkHealth(
      probe({
        database: () => new Promise<boolean>(() => {}),
        storage: async () => {
          throw new Error('maria@example.test');
        },
      }),
      3000,
    );
    await jest.advanceTimersByTimeAsync(3001);
    const report = await pending;
    jest.useRealTimers();

    expect(report.checks).toEqual({
      database: false,
      storage: false,
      queue: true,
    });
    expect(JSON.stringify(report)).not.toContain('maria');
  });

  it('valores impossíveis da fila não passam por saudáveis', async () => {
    for (const queue of [
      { oldestDueAgeMs: -1, dead: 0 },
      { oldestDueAgeMs: Number.NaN, dead: 0 },
      { oldestDueAgeMs: 0, dead: 0.5 },
    ]) {
      const report = await checkHealth(probe({ queue: async () => queue }));
      expect(report.checks.queue).toBe(false);
    }
  });
});

describe('GET /api/health', () => {
  it('público: só o estado, sem cache nem indexação', async () => {
    const res = createResponse();
    await createHealthHandler(() => probe())(
      { method: 'GET', headers: {} } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('503 sem detalhe quando algo falha', async () => {
    const res = createResponse();
    await createHealthHandler(() => probe({ database: async () => false }))(
      { method: 'GET', headers: {} } as never,
      res as never,
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ status: 'degraded' });
  });

  it('recusa métodos que não sejam GET', async () => {
    const res = createResponse();
    await createHealthHandler(() => probe())(
      { method: 'POST', headers: {} } as never,
      res as never,
    );

    expect(res.statusCode).toBe(405);
  });
});

describe('logger estruturado', () => {
  it('escreve uma linha JSON com campos permitidos e o utilizador em hash', () => {
    const lines: string[] = [];
    logEvent(
      'info',
      'application_submitted',
      {
        route: '/api/applications',
        durationMs: 12,
        userId: 'uid-123',
        requestId: 'req-1',
      },
      undefined,
      (line) => lines.push(line),
    );

    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry).toMatchObject({
      level: 'info',
      msg: 'application_submitted',
      route: '/api/applications',
      durationMs: 12,
      requestId: 'req-1',
    });
    expect(entry.userId).toMatch(/^[0-9a-f]{64}$/);
    expect(lines[0]).not.toContain('uid-123');
  });

  it('descarta PII, texto livre e a mensagem do erro', () => {
    const lines: string[] = [];
    const canary = 'maria@example.test +239 991 2345';
    logEvent(
      'error',
      'evento com espaços',
      {
        route: `/x?email=${canary}`,
        orgId: canary,
        errorCode: canary,
        requestId: canary,
      },
      new Error(canary),
      (line) => lines.push(line),
    );

    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry.msg).toBe('unclassified_event');
    expect(lines[0]).not.toContain('maria');
    expect(lines[0]).not.toContain('991');
    expect(entry.errorCategory).toBe('unexpected');
  });
});
