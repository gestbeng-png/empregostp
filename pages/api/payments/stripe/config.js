import { isOnlinePaymentEnabled } from '../../../../lib/payments/stripe';
import { DOBRAS_PER_EURO } from '../../../../lib/payments/currency';

// Público: diz ao cartão de pagamento se deve oferecer o pagamento online.
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json({
    enabled: isOnlinePaymentEnabled(),
    dobrasPerEuro: DOBRAS_PER_EURO,
  });
}
