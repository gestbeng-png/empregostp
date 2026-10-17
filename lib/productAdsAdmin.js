import { admin } from './firebaseAdmin';
import { cleanTextList, safeProductAdUrl } from './productAds';
import { isUserAccountActive } from './userStatus';

export async function requireProductAdsAdmin(req, res) {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : '';

  if (!token) {
    res.status(401).json({ message: 'Inicie sessão para continuar.' });
    return null;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token, true);
  } catch {
    res
      .status(401)
      .json({ message: 'Sessão inválida. Inicie sessão novamente.' });
    return null;
  }
  const user = await admin
    .firestore()
    .collection('users')
    .doc(decoded.uid)
    .get();
  if (
    !user.exists ||
    user.data()?.userType !== 'admin' ||
    !isUserAccountActive(user.data())
  ) {
    res.status(403).json({ message: 'Acesso reservado a administradores.' });
    return null;
  }
  return decoded.uid;
}

export function validateProductAdInput(body) {
  const title = String(body?.title || '').trim();
  const companyName = String(body?.companyName || '').trim();
  const description = String(body?.description || '').trim();
  const rawImageUrl = String(body?.imageUrl || '').trim();
  const rawHref = String(body?.href || '').trim();
  const imageUrl = safeProductAdUrl(rawImageUrl, { allowInternal: true });
  const href = safeProductAdUrl(rawHref, { allowInternal: true });
  const rawLogoUrl = String(body?.companyLogoUrl || '').trim();
  const companyLogoUrl = safeProductAdUrl(rawLogoUrl, { allowInternal: true });
  const badges = cleanTextList(body?.badges, { max: 2, length: 200 });
  const features = cleanTextList(body?.features, { max: 3, length: 200 });
  const priceLabel = String(body?.priceLabel || '').trim();
  const price = String(body?.price || '').trim();
  const priceSuffix = String(body?.priceSuffix || '').trim();
  const status = body?.status;
  const order = Number(body?.order ?? 0);

  if (!title || title.length > 100) {
    return { error: 'Indique um título de até 100 caracteres.' };
  }
  if (!companyName || companyName.length > 80) {
    return { error: 'Indique o nome da empresa (até 80 caracteres).' };
  }
  if (description.length > 260) {
    return { error: 'A descrição deve ter até 260 caracteres.' };
  }
  if (!imageUrl || rawImageUrl.length > 2048) {
    return { error: 'Indique um endereço válido para a imagem.' };
  }
  if (rawHref && (!href || rawHref.length > 2048)) {
    return { error: 'O endereço do site da empresa não é válido.' };
  }
  if (rawLogoUrl && (!companyLogoUrl || rawLogoUrl.length > 2048)) {
    return { error: 'O endereço do logótipo não é válido.' };
  }
  if (badges.some((badge) => badge.length > 28)) {
    return { error: 'Cada selo da imagem deve ter até 28 caracteres.' };
  }
  if (features.some((feature) => feature.length > 32)) {
    return { error: 'Cada destaque deve ter até 32 caracteres.' };
  }
  if (priceLabel.length > 30 || price.length > 24 || priceSuffix.length > 12) {
    return {
      error:
        'O preço deve ter até 24 caracteres, a legenda até 30 e o sufixo até 12.',
    };
  }
  if (!['draft', 'published'].includes(status)) {
    return { error: 'Selecione um estado válido para o anúncio.' };
  }
  if (!Number.isInteger(order) || order < 0 || order > 999) {
    return { error: 'A ordem deve ser um número entre 0 e 999.' };
  }

  return {
    data: {
      title,
      companyName,
      description,
      imageUrl,
      href,
      companyLogoUrl,
      badges,
      features,
      priceLabel,
      price,
      priceSuffix,
      status,
      order,
    },
  };
}
