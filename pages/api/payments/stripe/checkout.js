import { admin } from '../../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../../lib/apiUserAuth';
import { enforceApiRateLimit } from '../../../../lib/apiRateLimit';
import { resolveBaseUrl } from '../../../../lib/email/authEmails';
import { normalizeUserType } from '../../../../lib/defaultPlans';
import { logServerError } from '../../../../lib/serverLog';
import {
  assertRequestPayableOnline,
  createCheckoutSession,
} from '../../../../lib/payments/stripe';

const ERRORS = {
  REQUEST_NOT_FOUND: 404,
  REQUEST_NOT_PAYABLE: 409,
  ONLINE_PAYMENT_DISABLED: 503,
};

// Em desenvolvimento volta ao localhost; fora dele só ao domínio configurado.
function resolveReturnBase(req) {
  const host = String(req.headers?.host || '');
  if (
    process.env.NODE_ENV !== 'production' &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  ) {
    return `http://${host}`;
  }
  return resolveBaseUrl(req);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'stripe_checkout',
      limit: 10,
    }))
  ) {
    return;
  }

  const authResult = await requireActiveApiUser(req, res, { adminApp: admin });
  if (!authResult) return;
  const { uid, userData, decodedToken } = authResult;

  const requestId = String(req.body?.requestId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  try {
    const snapshot = await admin
      .firestore()
      .collection('subscription-requests')
      .doc(requestId)
      .get();
    const request = snapshot.exists ? snapshot.data() : null;
    assertRequestPayableOnline(request, uid);

    const dashboard =
      normalizeUserType(userData.userType) === 'empresa'
        ? '/dashboard/empresa'
        : '/dashboard/candidato';
    const session = await createCheckoutSession({
      requestId,
      request,
      customerEmail: userData.email || decodedToken.email || '',
      returnUrl: `${resolveReturnBase(req)}${dashboard}?tab=plans`,
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    const status = ERRORS[error?.code];
    if (status) {
      return res
        .status(status)
        .json({ error: error.message, code: error.code });
    }
    logServerError('stripe.checkout_create_failed', error);
    return res.status(502).json({
      error: 'Não foi possível abrir o pagamento online. Tente novamente.',
    });
  }
}
