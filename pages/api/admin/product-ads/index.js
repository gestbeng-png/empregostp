import { admin } from '../../../../lib/firebaseAdmin';
import {
  requireProductAdsAdmin,
  validateProductAdInput,
} from '../../../../lib/productAdsAdmin';
import { logServerError } from '../../../../lib/serverLog';

const collection = () => admin.firestore().collection('productAds');

export default async function handler(req, res) {
  try {
    const adminUid = await requireProductAdsAdmin(req, res);
    if (!adminUid) return;

    if (req.method === 'GET') {
      const snapshot = await collection().limit(200).get();
      const ads = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort(
          (a, b) =>
            (Number(a.order) || 0) - (Number(b.order) || 0) ||
            String(a.title || '').localeCompare(String(b.title || '')),
        )
        .map(({ createdAt, updatedAt, ...ad }) => ad);
      return res.status(200).json({ ads });
    }

    if (req.method === 'POST') {
      const { data, error } = validateProductAdInput(req.body);
      if (error) return res.status(400).json({ message: error });

      const doc = await collection().add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: adminUid,
      });
      return res.status(201).json({ id: doc.id, ...data });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Método não permitido.' });
  } catch (error) {
    logServerError('admin_product_ads.index_failed', error);
    return res
      .status(500)
      .json({ message: 'Não foi possível gerir os anúncios.' });
  }
}
