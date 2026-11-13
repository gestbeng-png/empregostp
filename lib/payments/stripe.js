import Stripe from 'stripe';
import { admin } from '../firebaseAdmin';
import { logServerError, logServerWarning } from '../serverLog';
import {
  approveSubscriptionRequest,
  isSubscriptionRequestOpen,
} from '../subscriptionActivation';
import {
  canChargeOnline,
  dobrasToEuroCents,
  formatPlanPrice,
} from './currency';

// Pagamento online dos planos pelo Stripe Checkout (página alojada pelo
// Stripe). Os métodos mostrados — cartão, PayPal, Apple Pay, Google Pay… —
// ligam-se no painel do Stripe, não aqui. O plano é ativado quando o Stripe
// confirma o pagamento: pelo webhook e, como reforço, quando o utilizador
// volta ao site com o id da sessão. As duas vias são idempotentes.

let stripeClient = null;

export function getStripe() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) return null;
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function isOnlinePaymentEnabled() {
  return Boolean(getStripe());
}

function requestsCollection() {
  return admin.firestore().collection('subscription-requests');
}

function stripeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** Pedido do próprio utilizador, em aberto, pago e ainda sem comprovativo. */
export function assertRequestPayableOnline(request, userId) {
  if (!request || request.userId !== userId) {
    throw stripeError('REQUEST_NOT_FOUND', 'Pedido não encontrado');
  }
  if (request.status !== 'pending') {
    throw stripeError(
      'REQUEST_NOT_PAYABLE',
      'Este pedido já não está à espera de pagamento.',
    );
  }
  if (request.paymentProof?.url) {
    throw stripeError(
      'REQUEST_NOT_PAYABLE',
      'Já enviou um comprovativo de transferência para este pedido. Aguarde a revisão da equipa.',
    );
  }
  if (!canChargeOnline(request.price)) {
    throw stripeError(
      'REQUEST_NOT_PAYABLE',
      'Este pedido não pode ser pago online.',
    );
  }
}

export async function createCheckoutSession({
  requestId,
  request,
  customerEmail,
  returnUrl,
}) {
  const stripe = getStripe();
  if (!stripe) {
    throw stripeError(
      'ONLINE_PAYMENT_DISABLED',
      'O pagamento online não está disponível de momento.',
    );
  }
  const amountCents = dobrasToEuroCents(request.price);

  // Um segundo clique (ou outro separador) reaproveita a sessão ainda aberta;
  // uma sessão antiga com outro valor é fechada para não poder ser paga.
  const previous = request.stripeCheckout;
  if (previous?.sessionId && previous.status === 'open') {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        previous.sessionId,
      );
      if (existing.status === 'open' && existing.amount_total === amountCents) {
        return existing;
      }
      if (existing.status === 'open') await expireCheckoutSession(existing.id);
    } catch (error) {
      logServerWarning('stripe.checkout_reuse_failed', error);
    }
  }

  const separator = returnUrl.includes('?') ? '&' : '?';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'pt',
    client_reference_id: requestId,
    customer_email: customerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amountCents,
          product_data: {
            name: `Plano ${request.planName || request.planId} — EmpregoSTP`,
            description: `${formatPlanPrice(request.price)} · ${Number(request.duration) || 30} dias`,
          },
        },
      },
    ],
    metadata: { requestId, userId: request.userId },
    payment_intent_data: { metadata: { requestId, userId: request.userId } },
    success_url: `${returnUrl}${separator}pagamento=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}${separator}pagamento=cancelado`,
  });

  await requestsCollection()
    .doc(requestId)
    .update({
      paymentMethod: 'stripe',
      stripeCheckout: {
        sessionId: session.id,
        amountCents,
        currency: 'eur',
        status: 'open',
        createdAt: admin.firestore.Timestamp.now(),
      },
      updatedAt: admin.firestore.Timestamp.now(),
    });

  return session;
}

/** Fecha a sessão de pagamento de um pedido cancelado (melhor esforço). */
export async function expireCheckoutSession(sessionId) {
  const stripe = getStripe();
  if (!stripe || !sessionId) return;
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (error) {
    // Já expirada ou concluída: nada a fazer.
    logServerWarning('stripe.checkout_expire_failed', error);
  }
}

export async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripe();
  if (!stripe) {
    throw stripeError(
      'ONLINE_PAYMENT_DISABLED',
      'O pagamento online não está disponível de momento.',
    );
  }
  return stripe.checkout.sessions.retrieve(sessionId);
}

async function recordPaymentIncident(session, reason, extra = {}) {
  logServerError(
    'stripe.payment_incident',
    new Error(`${reason} (sessão ${session.id})`),
  );
  // Pagamento recebido que não ativou nada: fica registado para a equipa
  // reembolsar ou ativar à mão.
  await admin
    .firestore()
    .collection('paymentIncidents')
    .doc(`stripe-${session.id}`)
    .set(
      {
        provider: 'stripe',
        reason,
        sessionId: session.id,
        paymentIntentId: session.payment_intent || null,
        requestId: session.metadata?.requestId || null,
        userId: session.metadata?.userId || null,
        amountTotal: session.amount_total ?? null,
        currency: session.currency || null,
        createdAt: admin.firestore.Timestamp.now(),
        resolved: false,
        ...extra,
      },
      { merge: true },
    );
}

/**
 * Ativa o plano de uma sessão de Checkout paga. Devolve o estado final do
 * pedido: 'approved', 'processing' (pagamento ainda por confirmar) ou
 * 'incident' (pago mas sem pedido válido para ativar).
 */
export async function fulfillCheckoutSession(session) {
  const requestId = String(session?.metadata?.requestId || '').trim();
  if (!requestId) {
    await recordPaymentIncident(session, 'missing_request_id');
    return { status: 'incident' };
  }
  if (session.payment_status !== 'paid') {
    return { status: 'processing', requestId };
  }

  const requestRef = requestsCollection().doc(requestId);
  const snapshot = await requestRef.get();
  const request = snapshot.exists ? snapshot.data() : null;

  if (!request) {
    await recordPaymentIncident(session, 'request_not_found');
    return { status: 'incident', requestId };
  }
  if (
    request.status === 'approved' &&
    request.stripeCheckout?.sessionId === session.id
  ) {
    return { status: 'approved', requestId, planName: request.planName };
  }
  if (!isSubscriptionRequestOpen(request)) {
    await recordPaymentIncident(session, `request_${request.status}`);
    return { status: 'incident', requestId };
  }

  const expectedCents = dobrasToEuroCents(request.price);
  if (
    session.currency !== 'eur' ||
    Number(session.amount_total) !== expectedCents ||
    session.metadata?.userId !== request.userId
  ) {
    await recordPaymentIncident(session, 'amount_or_owner_mismatch', {
      expectedCents,
    });
    return { status: 'incident', requestId };
  }

  try {
    const { planName } = await approveSubscriptionRequest({
      requestId,
      processedBy: 'stripe',
      paymentUpdate: {
        paymentMethod: 'stripe',
        'stripeCheckout.sessionId': session.id,
        'stripeCheckout.status': 'paid',
        'stripeCheckout.paymentIntentId': session.payment_intent || null,
        'stripeCheckout.amountTotal': session.amount_total,
        'stripeCheckout.currency': session.currency,
        'stripeCheckout.paidAt': admin.firestore.Timestamp.now(),
      },
    });
    return { status: 'approved', requestId, planName };
  } catch (error) {
    // O webhook e o regresso ao site podem chegar ao mesmo tempo: quem
    // perde a corrida encontra o pedido já aprovado por esta sessão.
    if (error?.code === 'REQUEST_ALREADY_PROCESSED') {
      const fresh = (await requestRef.get()).data();
      if (
        fresh?.status === 'approved' &&
        fresh?.stripeCheckout?.sessionId === session.id
      ) {
        return { status: 'approved', requestId, planName: fresh.planName };
      }
      await recordPaymentIncident(session, `request_${fresh?.status}`);
      return { status: 'incident', requestId };
    }
    throw error;
  }
}
