import { admin } from '../../../lib/firebaseAdmin';
import { serializeFirestoreValue } from '../../../lib/empresaPlansCatalog';
import { logServerError } from '../../../lib/serverLog';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const snapshot = await admin.firestore().collection('subscription-requests').where('userId', '==', decodedToken.uid).get();

    const openRequests = snapshot.docs
      .filter((doc) => {
        const status = doc.data()?.status;
        return status === 'pending' || status === 'payment_submitted';
      })
      .sort((a, b) => {
        const aData = a.data() || {};
        const bData = b.data() || {};
        return Math.max(toMillis(bData.updatedAt), toMillis(bData.createdAt)) - Math.max(toMillis(aData.updatedAt), toMillis(aData.createdAt));
      });

    if (openRequests.length === 0) {
      return res.status(200).json({ request: null });
    }

    const latest = openRequests[0];
    return res.status(200).json({
      request: {
        id: latest.id,
        ...serializeFirestoreValue(latest.data())
      }
    });
  } catch (error) {
    logServerError('subscription_requests_current.buscar_solicitacao_de_subscricao_atual_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
