import { collectPublicSitemap, renderPublicSitemap } from '../lib/publicSitemap';
import { resolveBaseUrl } from '../lib/authEmails';
import { logServerError } from '../lib/serverLog';

export async function getServerSideProps({ res }) {
  try {
    const { admin } = await import('../lib/firebaseAdmin');
    const entries = await collectPublicSitemap(admin.firestore());
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.write(renderPublicSitemap(entries, resolveBaseUrl()));
  } catch (error) {
    logServerError('sitemap.read_failed', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '300');
    res.write('Não foi possível gerar o sitemap. Tente novamente mais tarde.');
  }
  res.end();
  return { props: {} };
}

export default function SitemapXml() { return null; }
