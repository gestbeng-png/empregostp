import { sendResetPasswordEmail } from '@/lib/email/authEmails';
import { admin } from '@/lib/firebaseAdmin';
import usersHandler from '@/pages/api/admin/users';
import userHandler from '@/pages/api/admin/users/[id]';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('@/lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));
jest.mock('@/lib/serverLog', () => ({ logServerError: jest.fn() }));
jest.mock('@/lib/email/authEmails', () => ({
  resolveBaseUrl: jest.fn(() => 'https://empregostp.com'),
  sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
}));

function fixture(status = 'active', revoked = false) {
  const { db, docs } = createFakeFirestore({
    'users/admin-1': { name: 'Admin', userType: 'admin', status },
  });
  const auth = {
    verifyIdToken: jest.fn(async (_token: string, checkRevoked?: boolean) => {
      if (revoked && checkRevoked)
        throw Object.assign(new Error('Revoked'), {
          code: 'auth/id-token-revoked',
        });
      return { uid: 'admin-1' };
    }),
    createUser: jest.fn().mockResolvedValue({ uid: 'new-admin' }),
    updateUser: jest.fn().mockResolvedValue(undefined),
    generatePasswordResetLink: jest
      .fn()
      .mockResolvedValue('https://example.test/reset'),
  };
  jest.mocked(admin.auth).mockReturnValue(auth as never);
  jest.mocked(admin.firestore).mockReturnValue(db);
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return { auth, docs, res };
}

const routes = [
  {
    name: 'list users',
    handler: usersHandler,
    method: 'GET',
    body: {},
    query: {},
  },
  {
    name: 'create another admin',
    handler: usersHandler,
    method: 'POST',
    body: { name: 'New admin', email: 'new@example.test', userType: 'admin' },
    query: {},
  },
  {
    name: 'reactivate self',
    handler: userHandler,
    method: 'PUT',
    body: { name: 'Admin', status: 'active', userType: 'admin' },
    query: { id: 'admin-1' },
  },
];

describe.each(routes)(
  'admin authorization: $name',
  ({ handler, method, body, query }) => {
    beforeEach(() => jest.clearAllMocks());

    test.each(['suspended', 'inactive', 'disabled', 'deleted'])(
      'an admin with status %s cannot use the endpoint',
      async (status) => {
        const { docs, res, auth } = fixture(status);
        const before = [...docs.entries()];

        await handler(
          {
            method,
            body,
            query,
            headers: { authorization: 'Bearer old-token' },
          },
          res,
        );

        expect(res.status).toHaveBeenCalledWith(403);
        expect([...docs.entries()]).toEqual(before);
        expect(auth.createUser).not.toHaveBeenCalled();
        expect(auth.updateUser).not.toHaveBeenCalled();
        expect(sendResetPasswordEmail).not.toHaveBeenCalled();
      },
    );

    test('a revoked token is rejected before reading or writing account data', async () => {
      const { docs, res, auth } = fixture('active', true);
      const before = [...docs.entries()];

      await handler(
        { method, body, query, headers: { authorization: 'Bearer old-token' } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(admin.firestore).not.toHaveBeenCalled();
      expect([...docs.entries()]).toEqual(before);
      expect(auth.createUser).not.toHaveBeenCalled();
      expect(auth.updateUser).not.toHaveBeenCalled();
    });

    test('an active admin can still use the existing cookie authentication', async () => {
      const { res, auth } = fixture();

      await handler(
        {
          method,
          body,
          query,
          headers: {},
          cookies: { token: 'cookie-token' },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(method === 'POST' ? 201 : 200);
      expect(auth.verifyIdToken).toHaveBeenCalledWith('cookie-token', true);
    });
  },
);

test('a new admin gets the branded set-password email, never a raw Firebase link', async () => {
  const { res, auth } = fixture();
  await usersHandler(
    {
      method: 'POST',
      body: { name: 'Nova', email: '  Nova@Example.TEST ', userType: 'admin' },
      query: {},
      headers: { authorization: 'Bearer token' },
    },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(201);
  // A conta nasce sem senha; só a define quem recebe o email, por isso o
  // endereço fica verificado e o login (que o exige) deixa entrar.
  expect(auth.createUser).toHaveBeenCalledWith({
    email: 'nova@example.test',
    displayName: 'Nova',
    emailVerified: true,
  });
  expect(sendResetPasswordEmail).toHaveBeenCalledWith({
    email: 'nova@example.test',
    baseUrl: 'https://empregostp.com',
  });
  const body = res.json.mock.calls[0]?.[0];
  expect(body).toMatchObject({ passwordEmailSent: true });
  expect(JSON.stringify(body)).not.toContain('example.test/reset');
});
