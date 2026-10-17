const MAX_PUBLIC_ADS = 12;

export function safeProductAdUrl(value, { allowInternal = false } = {}) {
  const url = String(value || '').trim();
  if (allowInternal && url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

function cleanText(value, max) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

export function cleanTextList(value, { max, length }) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item, length))
    .filter(Boolean)
    .slice(0, max);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

export function normalizePublicProductAd(id, data, now = Date.now()) {
  if (data?.status !== 'published') return null;

  const title = String(data.title || '').trim();
  const companyName = String(data.companyName || '').trim();
  const imageUrl = safeProductAdUrl(data.imageUrl, { allowInternal: true });
  const startsAt = toMillis(data.startsAt);
  const endsAt = toMillis(data.endsAt);

  if (!title || !companyName || !imageUrl) return null;
  if (startsAt && startsAt > now) return null;
  if (endsAt && endsAt < now) return null;

  return {
    id,
    title,
    companyName,
    description: String(data.description || '').trim(),
    imageUrl,
    href: safeProductAdUrl(data.href, { allowInternal: true }),
    companyLogoUrl: safeProductAdUrl(data.companyLogoUrl, {
      allowInternal: true,
    }),
    badges: cleanTextList(data.badges, { max: 2, length: 28 }),
    features: cleanTextList(data.features, { max: 3, length: 32 }),
    priceLabel: cleanText(data.priceLabel, 30),
    price: cleanText(data.price, 24),
    priceSuffix: cleanText(data.priceSuffix, 12),
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
  };
}

export async function fetchPublicProductAds(firestore) {
  try {
    const snapshot = await firestore
      .collection('productAds')
      .where('status', '==', 'published')
      .limit(50)
      .get();
    const now = Date.now();

    return snapshot.docs
      .map((doc) => normalizePublicProductAd(doc.id, doc.data(), now))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .slice(0, MAX_PUBLIC_ADS);
  } catch (error) {
    console.warn('[home] anúncios de produtos indisponíveis:', error);
    return [];
  }
}
