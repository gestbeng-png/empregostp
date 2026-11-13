import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError, logServerWarning } from '../../../../lib/serverLog';
import {
  fulfillCheckoutSession,
  getStripe,
} from '../../../../lib/payments/stripe';

// O Stripe assina o corpo exato do pedido: o parser do Next tem de ficar
// desligado para a assinatura poder ser verificada.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function markCheckout(session, status) {
  const requestId = session?.metadata?.requestId;
  if (!requestId) return;
  const ref = admin
    .firestore()
    .collection('subscription-requests')
    .doc(requestId);
  const snapshot = await ref.get();
  if (snapshot.data()?.stripeCheckout?.sessionId !== session.id) return;
  await ref.update({
    'stripeCheckout.status': status,
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const stripe = getStripe();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!stripe || !webhookSecret) {
    return res.status(503).json({ error: 'Pagamento online desligado' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      webhookSecret,
    );
  } catch (error) {
    logServerWarning('stripe.webhook_signature_invalid', error);
    return res.status(400).json({ error: 'Assinatura inválida' });
  }

  try {
    const session = event.data?.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await fulfillCheckoutSession(session);
        break;
      case 'checkout.session.async_payment_failed':
        await markCheckout(session, 'failed');
        break;
      case 'checkout.session.expired':
        await markCheckout(session, 'expired');
        break;
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    // 500 faz o Stripe voltar a tentar mais tarde.
    logServerError('stripe.webhook_processing_failed', error);
    return res.status(500).json({ error: 'Erro ao processar o evento' });
  }
}
