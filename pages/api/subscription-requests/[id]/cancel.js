import { admin } from '../../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../../lib/apiUserAuth';
import { assertRequestCancellable } from '../../../../lib/subscriptionLifecycle';
import { logServerError } from '../../../../lib/serverLog';
import { expireCheckoutSession } from '../../../../lib/payments/stripe';

// C12/E19 — o titular desiste de um pedido de plano ainda sem comprovativo.
// Sem isto ficava preso: um pedido em aberto impede pedir outro plano.
const ERRORS = {
  REQUEST_NOT_FOUND: 404,
  REQUEST_FORBIDDEN: 404,
  REQUEST_NOT_CANCELLABLE: 409,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authResult = await requireActiveApiUser(req, res, { adminApp: admin });
  if (!authResult) return;
  const { uid } = authResult;
  const id = String(req.query?.id || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  const db = admin.firestore();
  const requestRef = db.collection('subscription-requests').doc(id);
  try {
    let alreadyCancelled = false;
    let openCheckoutSessionId = null;
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      const request = snapshot.exists ? snapshot.data() : null;
      assertRequestCancellable(request, uid);
      if (request.status === 'cancelled') {
        alreadyCancelled = true;
        return;
      }
      if (request.stripeCheckout?.status === 'open') {
        openCheckoutSessionId = request.stripeCheckout.sessionId || null;
      }
      const now = admin.firestore.Timestamp.now();
      transaction.update(requestRef, {
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: uid,
        updatedAt: now,
      });
      transaction.create(db.collection('auditLogs').doc(), {
        actorId: uid,
        actorType: 'USER',
        action: 'subscription_request_cancelled',
        resourceType: 'subscription-requests',
        resourceId: id,
        metadata: {},
        at: now,
      });
    });
    // Uma página de pagamento ainda aberta deixa de poder ser paga.
    await expireCheckoutSession(openCheckoutSessionId);
    return res
      .status(200)
      .json({ request: { id, status: 'cancelled' }, alreadyCancelled });
  } catch (error) {
    const status = ERRORS[error?.code];
    if (status) {
      // O pedido de outra pessoa responde como se não existisse.
      const message =
        error.code === 'REQUEST_NOT_CANCELLABLE'
          ? error.message
          : 'Pedido não encontrado';
      return res.status(status).json({ error: message, code: error.code });
    }
    logServerError('subscription_request.cancel_failed', error);
    return res.status(500).json({
      error: 'Não foi possível cancelar o pedido. Tente novamente.',
    });
  }
}
