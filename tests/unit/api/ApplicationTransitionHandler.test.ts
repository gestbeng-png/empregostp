import type { NextApiRequest, NextApiResponse } from 'next';

import { failure, success } from '@/domain/shared/Result';
import { createApplicationTransitionHandler } from '@/presentation/applications/createApplicationTransitionHandler';

function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = (
  body: unknown,
  headers: Record<string, string> = { 'idempotency-key': 'k-0000000000000001' },
) =>
  ({
    method: 'POST',
    query: { id: 'app-1' },
    headers,
    body,
  }) as unknown as NextApiRequest;

describe('POST /api/applications/[id]/transition', () => {
  const transition = jest.fn();
  const handler = createApplicationTransitionHandler({
    authenticate: async () => ({ uid: 'company-1' }),
    transition,
  });
  beforeEach(() => transition.mockReset());

  test('passa só campos permitidos e devolve o recibo', async () => {
    transition.mockResolvedValue(
      success({
        entityId: 'app-1',
        status: 'REJECTED',
        version: 3,
        eventId: 'e',
      }),
    );
    const res = response();
    await handler(
      req({
        to: 'REJECTED',
        expectedVersion: 2,
        closedReason: 'NOT_SELECTED',
        candidateVisibleNote: '  Obrigado.  ',
        rating: 5,
      }),
      res as unknown as NextApiResponse,
    );
    expect(transition).toHaveBeenCalledWith({
      actorUserId: 'company-1',
      applicationId: 'app-1',
      to: 'REJECTED',
      expectedVersion: 2,
      idempotencyKey: 'k-0000000000000001',
      reason: undefined,
      closedReason: 'NOT_SELECTED',
      candidateVisibleNote: 'Obrigado.',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test.each([
    [{ to: 'X' }, { 'idempotency-key': 'k' }],
    [{ to: 'X', expectedVersion: 1 }, {}],
    [{ expectedVersion: 1 }, { 'idempotency-key': 'k' }],
  ])(
    'pedido incompleto → 400 sem chamar o caso de uso',
    async (body, headers) => {
      const res = response();
      await handler(
        req(body, headers as Record<string, string>),
        res as unknown as NextApiResponse,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(transition).not.toHaveBeenCalled();
    },
  );

  test.each([
    ['FORBIDDEN', 403],
    ['FEATURE_DISABLED', 404],
    ['VERSION_CONFLICT', 409],
    ['INVALID_TRANSITION', 422],
    ['TRANSITION_GUARD_FAILED', 422],
  ] as const)(
    '%s → %i com { error: { code, message } }',
    async (code, status) => {
      transition.mockResolvedValue(failure(code));
      const res = response();
      await handler(
        req({ to: 'X', expectedVersion: 1 }),
        res as unknown as NextApiResponse,
      );
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({
        error: { code, message: expect.any(String) },
      });
    },
  );
});
