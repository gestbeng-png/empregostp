import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';
import { buildPushSubscriptionId } from '../../../lib/serverNotifications';

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const tokenHeader = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(tokenHeader);
    const { method } = req;

    if (method === 'POST') {
      const { token, permission = 'granted', userAgent = '' } = req.body || {};
      if (!token) {
        return res.status(400).json({ error: 'Token de push é obrigatório' });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const docId = buildPushSubscriptionId(token);
      await admin.firestore().collection('push-subscriptions').doc(docId).set({
        userId: decodedToken.uid,
        token,
        permission,
        enabled: permission === 'granted',
        platform: 'web',
        userAgent,
        updatedAt: now,
        createdAt: now
      }, { merge: true });

      return res.status(200).json({ message: 'Push web registado com sucesso' });
    }

    if (method === 'DELETE') {
      const { token } = req.body || {};
      if (!token) {
        return res.status(400).json({ error: 'Token de push é obrigatório' });
      }

      const docId = buildPushSubscriptionId(token);
      await admin.firestore().collection('push-subscriptions').doc(docId).delete();
      return res.status(200).json({ message: 'Push web removido com sucesso' });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    logServerError('push_subscription.request_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
