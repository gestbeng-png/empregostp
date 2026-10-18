import { admin } from '@/lib/firebaseAdmin';
import handler from '@/pages/api/cron/expire-offers';
jest.mock('@/lib/firebaseAdmin', () => ({ admin: { firestore: jest.fn() } }));
jest.mock('@/infrastructure/observability/logger', () => ({
  logEvent: jest.fn(),
}));

const previous = { secret: process.env.CRON_SECRET };
test('lote vazio responde sem escrever dados e termina paginação', async () => {
  process.env.CRON_SECRET = 'secret';
  const get = jest.fn().mockResolvedValue({ docs: [], size: 0 });
  const query = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    get,
  };
  (admin.firestore as unknown as jest.Mock).mockReturnValue({
    collection: jest.fn().mockReturnValue(query),
  });
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  await handler(
    {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: { cursor: 'offer-previous' },
    } as never,
    res as never,
  );
  expect(query.limit).toHaveBeenCalledWith(50);
  expect(query.startAfter).toHaveBeenCalledWith('offer-previous');
  expect(res.json).toHaveBeenCalledWith({
    status: 'processed',
    expired: 0,
    skipped: 0,
    failed: 0,
    nextCursor: null,
  });
});
afterAll(() => {
  if (previous.secret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous.secret;
});
test.each([
  ['GET', 'Bearer secret', undefined, 405],
  ['POST', 'Bearer wrong', undefined, 401],
  ['POST', 'Bearer secret', '../bad', 400],
])(
  'guard %s/%s bloqueia antes de aceder ao Firebase',
  async (method, authorization, cursor, status) => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'secret';
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await handler(
      { method, headers: { authorization }, body: { cursor } } as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(status);
    expect(admin.firestore).not.toHaveBeenCalled();
  },
);
