import { randomUUID } from 'crypto';
import { admin } from '../../../../lib/firebaseAdmin';
import { requireProductAdsAdmin } from '../../../../lib/productAdsAdmin';
import { logServerError } from '../../../../lib/serverLog';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const EXTENSIONS = { jpeg: 'jpg', png: 'png', webp: 'webp' };

function matchesImageSignature(buffer, type) {
  if (type === 'jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (type === 'png') {
    return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  }
  return (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Método não permitido.' });
  }

  try {
    const adminUid = await requireProductAdsAdmin(req, res);
    if (!adminUid) return;

    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
      String(req.body?.image || ''),
    );
    if (!match) {
      return res
        .status(400)
        .json({ message: 'Use uma imagem JPG, PNG ou WebP.' });
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ message: 'A imagem deve ter até 3 MB.' });
    }
    if (!matchesImageSignature(buffer, match[1])) {
      return res
        .status(400)
        .json({ message: 'O ficheiro não é uma imagem válida.' });
    }

    const bucket = admin.storage().bucket();
    const objectPath = `product-ads/${adminUid}/${randomUUID()}.${EXTENSIONS[match[1]]}`;
    const downloadToken = randomUUID();
    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      metadata: {
        contentType: `image/${match[1]}`,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
    return res.status(201).json({ imageUrl });
  } catch (error) {
    logServerError('admin_product_ads.upload_failed', error);
    return res
      .status(500)
      .json({ message: 'Não foi possível carregar a imagem.' });
  }
}
