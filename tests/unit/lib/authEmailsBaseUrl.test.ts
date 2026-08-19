import { resolveBaseUrl } from '../../../lib/authEmails';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {},
}));

jest.mock('../../../lib/email', () => ({
  sendEmail: jest.fn(),
}));

describe('resolveBaseUrl', () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalSiteUrl = process.env.SITE_URL;
  const originalPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = originalSiteUrl;
    if (originalPublicSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalPublicSiteUrl;
    }
    mutableEnv.NODE_ENV = originalNodeEnv;
  });

  test('ignora Origin, Host e forwarded host controlados pelo pedido', () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(
      resolveBaseUrl({
        headers: {
          host: 'atacante.example',
          origin: 'https://atacante.example',
          'x-forwarded-host': 'atacante.example',
          'x-forwarded-proto': 'https',
        },
      }),
    ).toBe('https://empregostp.vercel.app');
  });

  test('usa apenas o URL canónico HTTPS configurado', () => {
    process.env.SITE_URL = 'https://empregostp.example/';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ignorado.example';

    expect(resolveBaseUrl({ headers: { origin: 'https://evil.example' } })).toBe(
      'https://empregostp.example',
    );
  });

  test('recusa HTTP remoto e permite localhost apenas fora de produção', () => {
    mutableEnv.NODE_ENV = 'production';
    process.env.SITE_URL = 'http://atacante.example';
    expect(resolveBaseUrl({})).toBe('https://empregostp.vercel.app');

    mutableEnv.NODE_ENV = 'test';
    process.env.SITE_URL = 'http://localhost:3300/';
    expect(resolveBaseUrl({})).toBe('http://localhost:3300');
  });
});
