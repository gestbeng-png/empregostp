import handler from '@/pages/api/job-alerts';
import { createFakeFirestore } from '@/tests/helpers/fakeFirestore';

const fake = { current: createFakeFirestore() };
const verifyIdToken = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => {
  const firestore = Object.assign(() => fake.current.db, {
    FieldValue: { serverTimestamp: () => 'ts' },
  });
  return { admin: { auth: () => ({ verifyIdToken }), firestore } };
});

function response() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    setHeader: jest.fn(),
  };
  return res;
}

async function call(method: string, query: Record<string, string> = {}) {
  const res = response();
  await handler(
    {
      method,
      query,
      headers: { authorization: 'Bearer t' },
      body: {},
    } as never,
    res as never,
  );
  return res;
}

beforeEach(() => {
  fake.current = createFakeFirestore({
    'users/u1': { userType: 'candidato', email: 'Ana@Exemplo.st' },
    'jobAlerts/a1': {
      email: 'ana@exemplo.st',
      filters: { categoria: 'Finanças' },
      active: true,
      status: 'active',
      unsubscribeTokenHash: 'h',
    },
    'jobAlerts/a2': {
      email: 'ana@exemplo.st',
      filters: {},
      active: false,
      status: 'unsubscribed',
    },
    'jobAlerts/b1': {
      email: 'rui@exemplo.st',
      filters: {},
      active: true,
      status: 'active',
    },
  });
  verifyIdToken.mockResolvedValue({ uid: 'u1' });
});

test('lista só os alertas ativos do email da própria conta, sem tokens', async () => {
  const res = await call('GET');
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({
    alerts: [
      {
        id: 'a1',
        filters: { categoria: 'Finanças' },
        createdAt: null,
        lastNotifiedAt: null,
      },
    ],
  });
});

test('cancela um alerta próprio', async () => {
  const res = await call('DELETE', { id: 'a1' });
  expect(res).toMatchObject({ statusCode: 200, body: { cancelled: true } });
  expect(fake.current.docs.get('jobAlerts/a1')).toMatchObject({
    active: false,
    status: 'unsubscribed',
  });
});

test('o alerta de outra pessoa responde 404 e não muda', async () => {
  const res = await call('DELETE', { id: 'b1' });
  expect(res.statusCode).toBe(404);
  expect(fake.current.docs.get('jobAlerts/b1')).toMatchObject({ active: true });
});

test('sem sessão responde 401', async () => {
  const res = response();
  await handler(
    { method: 'GET', query: {}, headers: {}, body: {} } as never,
    res as never,
  );
  expect(res.statusCode).toBe(401);
});
