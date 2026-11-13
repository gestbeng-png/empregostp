import { admin } from '../../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../../lib/apiUserAuth';
import { enforceApiRateLimit } from '../../../../lib/apiRateLimit';
import { logServerError } from '../../../../lib/serverLog';
import {
  fulfillCheckoutSession,
  retrieveCheckoutSession,
} from '../../../../lib/payments/stripe';

// Chamado quando o utilizador volta do Stripe. Não confia no regresso em si:
// lê a sessão ao Stripe e só ativa o plano se estiver paga. É o reforço do
// webhook (que pode chegar uns segundos depois, ou não estar configurado em
// desenvolvimento).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'stripe_confirm',
      limit: 20,
    }))
  ) {
    return;
  }

  const authResult = await requireActiveApiUser(req, res, { adminApp: admin });
  if (!authResult) return;
  const { uid } = authResult;

  const sessionId = String(req.body?.sessionId || '').trim();
  if (!/^cs_[A-Za-z0-9_]{1,250}$/.test(sessionId)) {
    return res.status(404).json({ error: 'Pagamento não encontrado' });
  }

  try {
    const session = await retrieveCheckoutSession(sessionId);
    if (session?.metadata?.userId !== uid) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    const result = await fulfillCheckoutSession(session);
    return res
      .status(200)
      .json({ status: result.status, planName: result.planName || null });
  } catch (error) {
    if (error?.code === 'ONLINE_PAYMENT_DISABLED') {
      return res.status(503).json({ error: error.message });
    }
    if (error?.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    logServerError('stripe.checkout_confirm_failed', error);
    return res.status(502).json({
      error:
        'Não foi possível confirmar o pagamento agora. Se foi cobrado, o plano será ativado automaticamente.',
    });
  }
}
