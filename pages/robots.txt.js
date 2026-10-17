const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://empregostp.com').replace(/\/+$/, '');

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.write(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /dashboard/',
      'Disallow: /setup/',
      'Disallow: /_design',
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      '',
    ].join('\n'),
  );
  res.end();

  return { props: {} };
}

export default function RobotsTxt() {
  return null;
}
