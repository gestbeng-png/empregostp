import { isValidEmail, normalizeEmail } from '../../../lib/validation';
import {
  sendResetPasswordEmail,
  resolveBaseUrl,
} from '../../../lib/authEmails';
import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { logServerError, logServerWarning } from '../../../lib/serverLog';
import { createHash } from 'node:crypto';

/**
 * Envia o email de redefinição de senha com a marca EmpregoSTP.
 * Público (recebe apenas o email). Responde sempre 200 quando o email é válido,
 * mesmo que a conta não exista, para não revelar quais emails estão registados.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'auth_password_reset',
      limit: 5,
      windowMs: 15 * 60_000,
      failClosed: true,
      message: 'Demasiados pedidos de recuperação. Tente novamente mais tarde.',
    }))
  ) {
    return;
  }

  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  // Segundo balde independente do IP. O email nunca entra no identificador
  // do Firestore: apenas o SHA-256 estável, suficiente para travar ataques
  // distribuídos contra uma conta sem armazenar PII no rate limit.
  const emailPartition = createHash('sha256').update(email).digest('hex');
  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'auth_password_reset_account',
      limit: 3,
      windowMs: 15 * 60_000,
      failClosed: true,
      partition: `email_${emailPartition}`,
      message: 'Demasiados pedidos de recuperação. Tente novamente mais tarde.',
    }))
  ) {
    return;
  }

  try {
    await sendResetPasswordEmail({ email, baseUrl: resolveBaseUrl(req) });
    return res.status(200).json({ message: 'Email de recuperação enviado.' });
  } catch (error) {
    // Conta inexistente: não revelar. Responder como sucesso.
    if (error.code === 'auth/user-not-found') {
      return res.status(200).json({ message: 'Email de recuperação enviado.' });
    }
    if (error.code === 'EMAIL_NOT_CONFIGURED') {
      logServerWarning(
        'auth_send_password_reset.envio_de_email_nao_configurado_send_password_failed',
        undefined,
      );
      return res.status(503).json({ error: 'Serviço de email indisponível.' });
    }
    logServerError(
      'auth_send_password_reset.enviar_email_de_recuperacao_failed',
      error,
    );
    return res
      .status(500)
      .json({ error: 'Não foi possível enviar o email de recuperação.' });
  }
}
