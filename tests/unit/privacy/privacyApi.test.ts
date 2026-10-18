import handler from '@/pages/api/me/privacy';
import { createFakeFirestore } from '@/tests/helpers/fakeFirestore';

const NOW = Date.parse('2026-10-11T12:00:00.000Z');
const fake = { current: createFakeFirestore() };
const verifyIdToken = jest.fn();
const consumeRateLimit = jest.fn();
const sendEmail = jest.fn();
const collectCandidateExport = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => {
  const firestore = Object.assign(() => fake.current.db, {
    FieldValue: { delete: () => undefined, serverTimestamp: () => 'ts' },
    Timestamp: { now: () => 'now' },
  });
  return {
    admin: {
      app: () => ({ options: { projectId: 'test' } }),
      auth: () => ({ verifyIdToken }),
      firestore,
    },
  };
});
jest.mock('@/infrastructure/firebase/marketplace/consumeRateLimit', () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...args),
}));
jest.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));
jest.mock('@/lib/candidateDataExport', () => ({
  collectCandidateExport: (...args: unknown[]) =>
    collectCandidateExport(...args),
}));

function response() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    send(body: unknown) {
      res.body = body;
      return res;
    },
    end(body?: unknown) {
      res.body = body;
      return res;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
  };
  return res;
}

function request(method: string, body?: unknown, query = {}) {
  return {
    method,
    body,
    query,
    headers: { authorization: 'Bearer token' },
  };
}

async function call(method: string, body?: unknown, query = {}) {
  const res = response();
  await handler(request(method, body, query) as never, res as never);
  return res;
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  fake.current = createFakeFirestore({
    'users/cand1': { userType: 'candidato', email: 'ana@exemplo.st' },
    'profiles/cand1': {
      settings: { privacy: { profileVisibility: 'public' } },
    },
    'users/emp1': { userType: 'empresa', email: 'rh@empresa.st' },
  });
  verifyIdToken.mockResolvedValue({
    uid: 'cand1',
    auth_time: Math.floor(NOW / 1000) - 30,
  });
  consumeRateLimit.mockResolvedValue({ allowed: true });
  sendEmail.mockResolvedValue(undefined);
  collectCandidateExport.mockResolvedValue({
    schemaVersion: 1,
    applications: [],
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

const auditActions = () =>
  [...fake.current.docs.entries()]
    .filter(([path]) => path.startsWith('auditLogs/'))
    .map(([, data]) => data.action);

test('só candidatos usam esta área', async () => {
  verifyIdToken.mockResolvedValue({ uid: 'emp1', auth_time: NOW / 1000 });
  const res = await call('GET');
  expect(res.statusCode).toBe(403);
});

test('sem pedido pendente, o estado é nulo', async () => {
  const res = await call('GET');
  expect(res).toMatchObject({ statusCode: 200, body: { deletion: null } });
});

test('pedir a eliminação grava PENDING, esconde o perfil, audita e avisa por email', async () => {
  const res = await call('POST', {
    action: 'request_deletion',
    confirmation: 'ELIMINAR',
  });

  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({
    deletion: {
      status: 'PENDING',
      requestedAt: '2026-10-11T12:00:00.000Z',
      executeAfter: '2026-10-18T12:00:00.000Z',
    },
  });
  expect(fake.current.docs.get('users/cand1')).toMatchObject({
    deletion: { status: 'PENDING', executeAfterMs: NOW + 7 * 86_400_000 },
  });
  expect(fake.current.docs.get('profiles/cand1')).toMatchObject({
    pendingDeletion: true,
  });
  expect(auditActions()).toEqual(['account_deletion_requested']);
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'ana@exemplo.st',
      subject: 'Pedido de eliminação da conta recebido',
    }),
  );
});

test('uma falha no email não desfaz o pedido', async () => {
  sendEmail.mockRejectedValue(new Error('brevo em baixo'));
  const res = await call('POST', {
    action: 'request_deletion',
    confirmation: 'ELIMINAR',
  });
  expect(res.statusCode).toBe(200);
  expect(fake.current.docs.get('users/cand1')).toMatchObject({
    deletion: { status: 'PENDING' },
  });
});

test.each([
  [{ confirmation: 'sim' }, NOW / 1000 - 30, 'CONFIRMATION_REQUIRED'],
  [{ confirmation: 'ELIMINAR' }, NOW / 1000 - 600, 'REAUTH_REQUIRED'],
])('recusa sem gravar nada: %j', async (body, authTime, code) => {
  verifyIdToken.mockResolvedValue({ uid: 'cand1', auth_time: authTime });
  const res = await call('POST', { action: 'request_deletion', ...body });
  expect(res.statusCode).toBe(400);
  expect(res.body).toMatchObject({ code });
  expect(fake.current.docs.get('users/cand1')?.deletion).toBeUndefined();
  expect(
    fake.current.docs.get('profiles/cand1')?.pendingDeletion,
  ).toBeUndefined();
  expect(auditActions()).toEqual([]);
});

test('um segundo pedido responde 409', async () => {
  await call('POST', { action: 'request_deletion', confirmation: 'ELIMINAR' });
  const res = await call('POST', {
    action: 'request_deletion',
    confirmation: 'ELIMINAR',
  });
  expect(res.statusCode).toBe(409);
});

test('cancelar devolve o perfil e a conta ao normal', async () => {
  await call('POST', { action: 'request_deletion', confirmation: 'ELIMINAR' });
  const res = await call('POST', { action: 'cancel_deletion' });
  expect(res).toMatchObject({ statusCode: 200, body: { deletion: null } });
  expect(fake.current.docs.get('users/cand1')?.deletion).toBeUndefined();
  expect(
    fake.current.docs.get('profiles/cand1')?.pendingDeletion,
  ).toBeUndefined();
  expect(auditActions()).toEqual([
    'account_deletion_requested',
    'account_deletion_cancelled',
  ]);
});

test('exportar devolve um ficheiro JSON e fica auditado', async () => {
  const res = await call('GET', undefined, { export: '1' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['Content-Disposition']).toBe(
    'attachment; filename="empregostp-dados-2026-10-11.json"',
  );
  expect(JSON.parse(String(res.body))).toEqual({
    schemaVersion: 1,
    applications: [],
  });
  expect(collectCandidateExport).toHaveBeenCalledWith(
    expect.anything(),
    'cand1',
  );
  expect(auditActions()).toEqual(['personal_data_exported']);
});

test('exportar respeita o limite semanal', async () => {
  consumeRateLimit.mockResolvedValue({ allowed: false });
  const res = await call('GET', undefined, { export: '1' });
  expect(res.statusCode).toBe(429);
  expect(collectCandidateExport).not.toHaveBeenCalled();
  expect(consumeRateLimit).toHaveBeenCalledWith(
    expect.anything(),
    'personal_data_export',
    { userId: 'cand1' },
    expect.any(String),
  );
});
