import { isJobPubliclyVisible } from './jobExpiration';
import { isContentVisible } from './contentPublication';

export const PUBLIC_SITEMAP_ROUTES = [
  '/', '/vagas', '/empresas', '/recursos', '/blog', '/sobre-nos', '/contacto',
  '/carreira', '/premium', '/premium/candidatos', '/premium/empresa',
  '/recursos/calculadora-impostos', '/recursos/calculadora-salarial',
  '/recursos/gerador-cv', '/termos', '/politica-privacidade', '/cookies',
];

function timestamp(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Leitura apenas. Não expõe perfis, documentos privados nem estados internos. */
export async function collectPublicSitemap(db, now = new Date()) {
  const [jobs, posts, news] = await Promise.all(
    ['jobs', 'posts', 'news'].map((name) => db.collection(name).get()),
  );
  const entries = new Map(PUBLIC_SITEMAP_ROUTES.map((path) => [path, { path }]));
  const add = (prefix, doc, data) => {
    const path = `${prefix}/${encodeURIComponent(doc.id)}`;
    entries.set(path, { path, lastmod: timestamp(data.updatedAt || data.publishedAt || data.createdAt) });
  };
  jobs.docs.forEach((doc) => {
    const data = doc.data();
    if (isJobPubliclyVisible(data, now) && (!data.v2Status || data.v2Status === 'PUBLISHED') && !data.hidden) {
      add('/vaga', doc, data);
    }
  });
  const postIds = new Set(posts.docs.map((doc) => doc.id));
  posts.docs.forEach((doc) => {
    const data = doc.data();
    if (isContentVisible(data, now)) add('/blog', doc, data);
  });
  news.docs.forEach((doc) => {
    const data = doc.data();
    // /blog/[id] resolve posts antes de news, incluindo rascunhos.
    if (!postIds.has(doc.id) && isContentVisible(data, now)) add('/blog', doc, data);
  });
  if (entries.size > 50_000) throw new Error('SITEMAP_PARTITION_REQUIRED');
  return [...entries.values()];
}

export function renderPublicSitemap(entries, siteUrl) {
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(({ path, lastmod }) => `  <url><loc>${escape(`${siteUrl}${path}`)}</loc>${lastmod ? `<lastmod>${escape(lastmod)}</lastmod>` : ''}</url>`),
    '</urlset>',
  ].join('\n');
}
