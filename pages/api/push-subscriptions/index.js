import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';
import { buildPushSubscriptionId } from '../../../lib/serverNotifications';

const ALLOWED_METHODS = new Set(['POST', 'DELETE']);
const ALLOWED_PERMISSIONS = new Set(['default', 'denied', 'granted']);
const MAX_PUSH_TOKEN_LENGTH = 4096;
const MAX_USER_AGENT_LENGTH = 512;

function parsePushSubscriptionBody(body, method) {
  const token = body?.token;
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > MAX_PUSH_TOKEN_LENGTH ||
    /\s/.test(token)
  ) {
    return { error: 'Token de push inválido' };
  }

  if (method === 'DELETE') return { token };

  const permission = body?.permission ?? 'granted';
  if (!ALLOWED_PERMISSIONS.has(permission)) {
    return { error: 'Permissão de push inválida' };
  }

  const userAgent = body?.userAgent ?? '';
  if (
    typeof userAgent !== 'string' ||
    userAgent.length > MAX_USER_AGENT_LENGTH
  ) {
    return { error: 'Navegador inválido' };
  }

  return { permission, token, userAgent };
}

export default async function handler(req, res) {
  const { method } = req;
  if (!ALLOWED_METHODS.has(method)) {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  const bearerMatch =
    typeof authHeader === 'string' ? authHeader.match(/^Bearer ([^\s]+)$/) : null;
  if (!bearerMatch) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(bearerMatch[1]);
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const parsedBody = parsePushSubscriptionBody(req.body, method);
  if (parsedBody.error) {
    return res.status(400).json({ error: parsedBody.error });
  }

  try {
    const firestore = admin.firestore();
    const docId = buildPushSubscriptionId(parsedBody.token);
    const subscriptionRef = firestore
      .collection('push-subscriptions')
      .doc(docId);

    if (method === 'POST') {
      const now = admin.firestore.FieldValue.serverTimestamp();
      const outcome = await firestore.runTransaction(async (transaction) => {
        const existingSnapshot = await transaction.get(subscriptionRef);
        const existingData = existingSnapshot.exists
          ? existingSnapshot.data() || {}
          : null;

        if (existingData && existingData.userId !== decodedToken.uid) {
          return 'conflict';
        }

        const subscriptionData = {
          userId: decodedToken.uid,
          token: parsedBody.token,
          permission: parsedBody.permission,
          enabled: parsedBody.permission === 'granted',
          platform: 'web',
          userAgent: parsedBody.userAgent,
          updatedAt: now
        };
        if (!existingSnapshot.exists) {
          subscriptionData.createdAt = now;
        }

        transaction.set(subscriptionRef, subscriptionData, { merge: true });
        return 'registered';
      });

      if (outcome === 'conflict') {
        return res.status(409).json({
          error: 'Token de push já associado a outra conta'
        });
      }

      return res.status(200).json({ message: 'Push web registado com sucesso' });
    }

    const outcome = await firestore.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(subscriptionRef);
      if (!existingSnapshot.exists) return 'missing';

      const existingData = existingSnapshot.data() || {};
      if (existingData.userId !== decodedToken.uid) return 'forbidden';

      transaction.delete(subscriptionRef);
      return 'deleted';
    });

    if (outcome === 'forbidden') {
      return res.status(403).json({
        error: 'Sem permissão para remover esta subscrição push'
      });
    }

    return res.status(200).json({ message: 'Push web removido com sucesso' });
  } catch (error) {
    logServerError('push_subscription.request_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
