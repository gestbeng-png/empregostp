import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ManualPaymentProofCard from '@/components/ManualPaymentProofCard';
import { assertRequestCancellable } from '@/lib/subscriptionLifecycle';
import handler from '@/pages/api/subscription-requests/[id]/cancel';
import { createFakeFirestore } from '@/tests/helpers/fakeFirestore';

const fake = { current: createFakeFirestore() };
const verifyIdToken = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => {
  const firestore = Object.assign(() => fake.current.db, {
    Timestamp: { now: () => 'now' },
  });
  return { admin: { auth: () => ({ verifyIdToken }), firestore } };
});
jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }),
}));

describe('assertRequestCancellable', () => {
  test('o dono cancela um pedido ainda sem comprovativo', () => {
    expect(() =>
      assertRequestCancellable({ userId: 'u1', status: 'pending' }, 'u1'),
    ).not.toThrow();
  });

  test.each([
    [{ userId: 'u2', status: 'pending' }, 'REQUEST_FORBIDDEN'],
    [{ userId: 'u1', status: 'payment_submitted' }, 'REQUEST_NOT_CANCELLABLE'],
    [{ userId: 'u1', status: 'approved' }, 'REQUEST_NOT_CANCELLABLE'],
    [
      { userId: 'u1', status: 'pending', paymentProof: { url: 'x' } },
      'REQUEST_NOT_CANCELLABLE',
    ],
    [null, 'REQUEST_NOT_FOUND'],
  ])('recusa %j', (request, code) => {
    expect(() => assertRequestCancellable(request, 'u1')).toThrow(
      expect.objectContaining({ code }),
    );
  });
});

describe('POST /api/subscription-requests/[id]/cancel', () => {
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

  async function call(id: string) {
    const res = response();
    await handler(
      {
        method: 'POST',
        query: { id },
        headers: { authorization: 'Bearer t' },
        body: {},
      } as never,
      res as never,
    );
    return res;
  }

  beforeEach(() => {
    fake.current = createFakeFirestore({
      'users/u1': { userType: 'candidato', email: 'a@exemplo.st' },
      'subscription-requests/r1': { userId: 'u1', status: 'pending' },
      'subscription-requests/r2': { userId: 'u1', status: 'payment_submitted' },
      'subscription-requests/r3': { userId: 'u2', status: 'pending' },
    });
    verifyIdToken.mockResolvedValue({ uid: 'u1' });
  });

  const audits = () =>
    [...fake.current.docs.keys()].filter((path) =>
      path.startsWith('auditLogs/'),
    );

  test('cancela, audita e permite pedir outro plano', async () => {
    const res = await call('r1');
    expect(res.statusCode).toBe(200);
    expect(fake.current.docs.get('subscription-requests/r1')).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'u1',
    });
    expect(audits()).toHaveLength(1);

    const again = await call('r1');
    expect(again).toMatchObject({
      statusCode: 200,
      body: { alreadyCancelled: true },
    });
    expect(audits()).toHaveLength(1);
  });

  test('depois do comprovativo responde 409 e não muda nada', async () => {
    const res = await call('r2');
    expect(res.statusCode).toBe(409);
    expect(fake.current.docs.get('subscription-requests/r2')?.status).toBe(
      'payment_submitted',
    );
  });

  test('o pedido de outra pessoa responde 404', async () => {
    const res = await call('r3');
    expect(res.statusCode).toBe(404);
    expect(fake.current.docs.get('subscription-requests/r3')?.status).toBe(
      'pending',
    );
  });
});

describe('ManualPaymentProofCard — cancelar pedido', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const request = {
    id: 'r1',
    status: 'pending',
    planName: 'Profissional',
    price: 100,
  };

  test('pede confirmação e só fecha depois de o servidor confirmar', async () => {
    const user = userEvent.setup();
    let resolve: (value: Response) => void = () => {};
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ) as typeof fetch;
    const onCancelled = jest.fn();
    render(
      <ManualPaymentProofCard
        request={request}
        onSubmitted={jest.fn()}
        onCancelled={onCancelled}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    await user.click(
      screen.getByRole('button', { name: 'Sim, cancelar pedido' }),
    );
    expect(
      screen.getByRole('button', { name: 'A cancelar...' }),
    ).toBeDisabled();
    expect(onCancelled).not.toHaveBeenCalled();

    resolve({
      ok: true,
      status: 200,
      json: async () => ({ request: { id: 'r1', status: 'cancelled' } }),
    } as Response);
    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith('r1'));
  });

  test('mostra o motivo do servidor quando não é possível cancelar', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Já enviou o comprovativo.' }),
    })) as unknown as typeof fetch;
    const onCancelled = jest.fn();
    render(
      <ManualPaymentProofCard
        request={request}
        onSubmitted={jest.fn()}
        onCancelled={onCancelled}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    await user.click(
      screen.getByRole('button', { name: 'Sim, cancelar pedido' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já enviou o comprovativo.',
    );
    expect(onCancelled).not.toHaveBeenCalled();
  });

  test('não oferece cancelar depois de enviado o comprovativo', () => {
    render(
      <ManualPaymentProofCard
        request={{
          ...request,
          status: 'payment_submitted',
          paymentProof: { url: 'https://x' },
        }}
        onSubmitted={jest.fn()}
        onCancelled={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Cancelar pedido' }),
    ).not.toBeInTheDocument();
  });
});
