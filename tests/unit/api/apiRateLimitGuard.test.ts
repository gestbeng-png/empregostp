import { admin } from '../../../lib/firebaseAdmin';
import { consumeFirestoreRateLimit } from '../../../lib/firestoreRateLimit';
import { logServerWarning } from '../../../lib/serverLog';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';

jest.mock('../../../lib/firebaseAdmin', () => {
  const mockedAdmin = { firestore: jest.fn() };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/firestoreRateLimit', () => ({
  consumeFirestoreRateLimit: jest.fn(),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerWarning: jest.fn(),
}));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const mockedConsume = jest.mocked(consumeFirestoreRateLimit);
const mockedWarning = jest.mocked(logServerWarning);

function createResponse() {
  const response = {
    json: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

describe('getClientIp', () => {
  test('usa a primeira entrada de x-forwarded-for sem espaços', () => {
    expect(
      getClientIp({
        headers: { 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' },
      }),
    ).toBe('203.0.113.7');
  });

  test('cai para x-real-ip e remoteAddress por esta ordem', () => {
    expect(
      getClientIp({ headers: { 'x-real-ip': '198.51.100.4' } }),
    ).toBe('198.51.100.4');
    expect(
      getClientIp({ headers: {}, socket: { remoteAddress: '192.0.2.9' } }),
    ).toBe('192.0.2.9');
  });

  test('devolve unknown quando não há qualquer origem', () => {
    expect(getClientIp({ headers: {} })).toBe('unknown');
  });
});

describe('enforceApiRateLimit', () => {
  const fakeDb = { runTransaction: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    firestoreMock.mockReturnValue(fakeDb);
  });

  test('permite o pedido, expõe o restante e compõe a chave por scope e IP', async () => {
    mockedConsume.mockResolvedValue({
      allowed: true,
      remaining: 3,
      retryAfterSeconds: 0,
    });

    const response = createResponse();
    const allowed = await enforceApiRateLimit(
      {
        headers: { 'x-forwarded-for': '203.0.113.7' },
      },
      response,
      { scope: 'register', limit: 5 },
    );

    expect(allowed).toBe(true);
    expect(mockedConsume).toHaveBeenCalledWith({
      firestore: fakeDb,
      key: 'register_203.0.113.7',
      limit: 5,
      windowMs: 60_000,
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      '3',
    );
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  test('bloqueia com 429 em português e Retry-After quando o limite esgota', async () => {
    mockedConsume.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });

    const response = createResponse();
    const allowed = await enforceApiRateLimit(
      { headers: { 'x-real-ip': '198.51.100.4' } },
      response,
      { scope: 'contact', limit: 5 },
    );

    expect(allowed).toBe(false);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      '0',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Demasiados pedidos. Tente novamente dentro de um minuto.',
    });
  });

  test('usa a mensagem específica da rota quando fornecida', async () => {
    mockedConsume.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 10,
    });

    const response = createResponse();
    await enforceApiRateLimit(
      { headers: {} },
      response,
      {
        scope: 'testimonials',
        limit: 3,
        message: 'Demasiadas submissões. Tente novamente dentro de um minuto.',
      },
    );

    expect(response.json).toHaveBeenCalledWith({
      error: 'Demasiadas submissões. Tente novamente dentro de um minuto.',
    });
  });

  test('propaga janelas personalizadas para o limitador', async () => {
    mockedConsume.mockResolvedValue({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });

    const response = createResponse();
    await enforceApiRateLimit({ headers: {} }, response, {
      scope: 'newsletter',
      limit: 2,
      windowMs: 300_000,
    });

    expect(mockedConsume).toHaveBeenCalledWith(
      expect.objectContaining({ windowMs: 300_000 }),
    );
  });

  test('falha aberto com aviso classificado quando o limitador rebenta', async () => {
    const infraError = Object.assign(
      new Error('token canário deadline atingido'),
      { code: 'firestore/deadline-exceeded' },
    );
    mockedConsume.mockRejectedValue(infraError);

    const response = createResponse();
    const allowed = await enforceApiRateLimit(
      { headers: { 'x-forwarded-for': '203.0.113.7' } },
      response,
      { scope: 'register', limit: 5 },
    );

    expect(allowed).toBe(true);
    expect(mockedWarning).toHaveBeenCalledWith(
      'rate_limit.check_failed',
      infraError,
    );
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
