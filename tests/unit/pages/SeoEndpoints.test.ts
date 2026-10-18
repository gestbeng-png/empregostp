import { getServerSideProps as robotsGetServerSideProps } from '../../../pages/robots.txt';
import { getServerSideProps as sitemapGetServerSideProps } from '../../../pages/sitemap.xml';

const mockGet = jest.fn();
jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { firestore: () => ({ collection: () => ({ get: mockGet }) }) },
}));
jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));
beforeEach(() => mockGet.mockResolvedValue({ docs: [] }));

function responseMock() {
  return {
    end: jest.fn(),
    setHeader: jest.fn(),
    write: jest.fn(),
    statusCode: 200,
  };
}

describe('SEO public endpoints', () => {
  it('serve robots.txt com áreas privadas bloqueadas e sitemap declarado', async () => {
    const res = responseMock();

    await robotsGetServerSideProps({ res } as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; charset=utf-8',
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('Disallow: /dashboard/'),
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('Sitemap: https://empregostp.com/sitemap.xml'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.write.mock.calls[0][0]).not.toContain('Disallow: /_next/');
  });

  it('serve sitemap XML apenas com rotas públicas canónicas', async () => {
    const res = responseMock();

    await sitemapGetServerSideProps({ res } as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/xml; charset=utf-8',
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('<loc>https://empregostp.com/vagas</loc>'),
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.not.stringContaining('/dashboard/'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('falha de leitura não publica um sitemap vazio com sucesso', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    const res = responseMock();
    await sitemapGetServerSideProps({ res });
    expect(res.statusCode).toBe(503);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Não foi possível'));
  });
});
