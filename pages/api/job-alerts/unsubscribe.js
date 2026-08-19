import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { isValidJobAlertUnsubscribeToken } from '../../../lib/jobAlertSubscription';
import { logServerError } from '../../../lib/serverLog';

const SAFE_ALERT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'job_alert_unsubscribe',
      limit: 10,
    }))
  ) {
    return;
  }

  const alertId = String(req.body?.alertId || '').trim();
  const token = String(req.body?.token || '').trim();
  if (!SAFE_ALERT_ID.test(alertId) || !token) {
    return res.status(400).json({
      error: 'O link de cancelamento é inválido ou já expirou.',
    });
  }

  try {
    const alertRef = admin.firestore().collection('jobAlerts').doc(alertId);
    const alertSnapshot = await alertRef.get();
    const alertData = alertSnapshot.exists ? alertSnapshot.data() || {} : {};

    if (
      !alertSnapshot.exists ||
      !isValidJobAlertUnsubscribeToken(
        token,
        alertData.unsubscribeTokenHash,
      )
    ) {
      return res.status(400).json({
        error: 'O link de cancelamento é inválido ou já expirou.',
      });
    }

    if (alertData.active === false || alertData.status === 'unsubscribed') {
      return res.status(200).json({
        message: 'Este alerta já se encontra cancelado.',
        alreadyUnsubscribed: true,
      });
    }

    await alertRef.update({
      active: false,
      status: 'unsubscribed',
      unsubscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      message: 'O alerta de vagas foi cancelado com sucesso.',
      alreadyUnsubscribed: false,
    });
  } catch (error) {
    logServerError('job_alerts.cancelar_alerta_failed', error);
    return res.status(500).json({
      error: 'Não foi possível cancelar o alerta. Tente novamente.',
    });
  }
}
