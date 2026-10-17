import { admin } from '../../../../lib/firebaseAdmin';
import {
  requireProductAdsAdmin,
  validateProductAdInput,
} from '../../../../lib/productAdsAdmin';
import { logServerError } from '../../../../lib/serverLog';

export default async function handler(req, res) {
  try {
    const adminUid = await requireProductAdsAdmin(req, res);
    if (!adminUid) return;

    const id = String(req.query.id || '');
    if (!id || id.includes('/')) {
      return res.status(400).json({ message: 'Anúncio inválido.' });
    }

    const ref = admin.firestore().collection('productAds').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return res.status(404).json({ message: 'Anúncio não encontrado.' });
    }

    if (req.method === 'PUT') {
      const { data, error } = validateProductAdInput(req.body);
      if (error) return res.status(400).json({ message: error });
      await ref.update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: adminUid,
      });
      return res.status(200).json({ id, ...data });
    }

    if (req.method === 'DELETE') {
      await ref.delete();
      return res.status(200).json({ id });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ message: 'Método não permitido.' });
  } catch (error) {
    logServerError('admin_product_ads.id_failed', error);
    return res
      .status(500)
      .json({ message: 'Não foi possível gerir o anúncio.' });
  }
}
