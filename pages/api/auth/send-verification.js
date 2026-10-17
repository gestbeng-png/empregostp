import { admin } from '../../../lib/firebaseAdmin';
import { isValidEmail } from '../../../lib/validation';
import { sendVerificationEmail, resolveBaseUrl } from '../../../lib/authEmails';
import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { logServerError, logServerWarning } from '../../../lib/serverLog';

/**
 * Envia o email de confirmação de conta com a marca EmpregoSTP.
 * Requer o ID token do utilizador autenticado (Authorization: Bearer ...).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'auth_email_verification',
      limit: 5,
      windowMs: 10 * 60_000,
      failClosed: true,
      message: 'Demasiados pedidos de confirmação. Tente novamente mais tarde.',
    }))
  ) {
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email;

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    if (decodedToken.email_verified) {
      // Já está confirmado — nada a fazer.
      return res.status(200).json({ message: 'Email já confirmado.' });
    }

    const { name, returnTo } = req.body || {};

    await sendVerificationEmail({
      email,
      baseUrl: resolveBaseUrl(req),
      name: typeof name === 'string' ? name.trim() : undefined,
      returnTo,
    });

    return res.status(200).json({ message: 'Email de confirmação enviado.' });
  } catch (error) {
    if (error.code === 'EMAIL_NOT_CONFIGURED') {
      logServerWarning(
        'auth_send_verification.envio_de_email_nao_configurado_send_verifica_failed',
        undefined,
      );
      return res.status(503).json({ error: 'Serviço de email indisponível.' });
    }
    logServerError(
      'auth_send_verification.enviar_email_de_confirmacao_failed',
      error,
    );
    return res
      .status(500)
      .json({ error: 'Não foi possível enviar o email de confirmação.' });
  }
}
