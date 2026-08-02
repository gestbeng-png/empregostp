import { isValidEmail, normalizeEmail } from '../../../lib/validation';
import { sendResetPasswordEmail, resolveBaseUrl } from '../../../lib/authEmails';
import { logServerError, logServerWarning } from '../../../lib/serverLog';

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

  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
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
      logServerWarning('auth_send_password_reset.envio_de_email_nao_configurado_send_password_failed', undefined);
      return res.status(503).json({ error: 'Serviço de email indisponível.' });
    }
    logServerError('auth_send_password_reset.enviar_email_de_recuperacao_failed', error);
    return res.status(500).json({ error: 'Não foi possível enviar o email de recuperação.' });
  }
}
