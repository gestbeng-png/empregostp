function toTitleCase(value = '') {
  return String(value)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeLinkedInUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (!raw.includes('.') && !raw.includes('/')) {
    return `https://www.linkedin.com/in/${raw.replace(/^@/, '')}/`;
  }

  const prefixed = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(prefixed);
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (!hostname.includes('linkedin.com')) {
      return raw;
    }

    const pathname = url.pathname.replace(/\/+/g, '/').replace(/\/$/, '');
    url.protocol = 'https:';
    url.hostname = 'www.linkedin.com';
    url.pathname = pathname || '/';
    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/$/, pathname === '/' ? '/' : '');
  } catch (error) {
    return raw;
  }
}

export function extractLinkedInProfileHints(value = '') {
  const normalizedUrl = normalizeLinkedInUrl(value);
  try {
    const url = new URL(normalizedUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const slug = parts[1] || parts[0] || '';

    return {
      normalizedUrl,
      slug,
      inferredName: slug ? toTitleCase(slug) : ''
    };
  } catch (error) {
    return {
      normalizedUrl,
      slug: '',
      inferredName: ''
    };
  }
}
