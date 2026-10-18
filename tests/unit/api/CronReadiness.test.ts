import handler from '@/pages/api/cron/readiness';

function response() {
  const res = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}
describe('Read-only cron email readiness', () => {
  const env = { ...process.env };
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-test-secret';
    process.env.BREVO_API_KEY = 'provider-test-secret';
    process.env.EMAIL_FROM_ADDRESS = 'sender@example.com';
    global.fetch = jest.fn();
  });
  afterEach(() => {
    process.env = { ...env };
    global.fetch = originalFetch;
  });
  it('rejects unauthenticated requests before touching the provider', async () => {
    const res = response();
    await handler({ method: 'GET', headers: {} } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects writes even with a cron bearer', async () => {
    const res = response();
    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer cron-test-secret' },
      } as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(405);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('checks the verified sender without sending email or exporting any addresses or keys', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          senders: [{ email: 'sender@example.com', active: true }],
        }),
      } as Response);
    const res = response();
    await handler(
      {
        method: 'GET',
        headers: { authorization: 'Bearer cron-test-secret' },
      } as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'ready',
      email: { providerStatus: 200, senderVerified: true },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/senders',
      expect.objectContaining({ redirect: 'error' }),
    );
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(
      /sender@example|secret/,
    );
  });
  it.each([401, 429, 500])(
    'fails closed on provider HTTP %s',
    async (status) => {
      jest
        .mocked(fetch)
        .mockResolvedValue({
          ok: false,
          status,
          json: async () => ({ message: 'secret@example.com' }),
        } as Response);
      const res = response();
      await handler(
        {
          method: 'GET',
          headers: { authorization: 'Bearer cron-test-secret' },
        } as never,
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(503);
      expect(JSON.stringify(res.json.mock.calls)).not.toContain(
        'secret@example',
      );
    },
  );
  it('does not trust an unverified sender', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          senders: [{ email: 'sender@example.com', active: false }],
        }),
      } as Response);
    const res = response();
    await handler(
      {
        method: 'GET',
        headers: { authorization: 'Bearer cron-test-secret' },
      } as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(503);
  });
  it('reports provider outages without exception content', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('secret-address-and-token'));
    const res = response();
    await handler(
      {
        method: 'GET',
        headers: { authorization: 'Bearer cron-test-secret' },
      } as never,
      res as never,
    );
    expect(res.json).toHaveBeenCalledWith({
      status: 'not_ready',
      code: 'EMAIL_PROVIDER_UNAVAILABLE',
    });
  });
});
