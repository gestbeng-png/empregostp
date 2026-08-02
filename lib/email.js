import nodemailer from 'nodemailer';

// Envio de emails via Gmail SMTP (nodemailer).
// Requer as variáveis de ambiente:
//   GMAIL_USER          -> o teu endereço Gmail (ex.: edmirsantos28@gmail.com)
//   GMAIL_APP_PASSWORD  -> uma "palavra-passe de app" (16 letras) gerada no Gmail
//                          com a verificação em 2 passos ativa.
// O Gmail exige que o remetente seja a própria conta autenticada, por isso o
// "De:" usa sempre o GMAIL_USER (só o nome apresentado é personalizável).

let transporter = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function getDefaultFrom() {
  const user = process.env.GMAIL_USER || '';
  const name = process.env.EMAIL_FROM_NAME || 'EmpregoSTP';
  return `${name} <${user}>`;
}

/**
 * Envia um email. Lança erro com `code` para o chamador poder distinguir
 * "não configurado" de "falha no envio".
 */
export async function sendEmail({ to, bcc, subject, html, text, replyTo }) {
  const mailer = getTransporter();
  if (!mailer) {
    const error = new Error('Serviço de email não configurado (falta GMAIL_USER / GMAIL_APP_PASSWORD).');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  try {
    const info = await mailer.sendMail({
      from: getDefaultFrom(),
      to: Array.isArray(to) ? to.join(', ') : to || getDefaultFrom(),
      ...(bcc ? { bcc: Array.isArray(bcc) ? bcc.join(', ') : bcc } : {}),
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
    return info;
  } catch (cause) {
    const err = new Error(cause?.message || 'Falha ao enviar email.');
    err.code = 'EMAIL_SEND_FAILED';
    err.details = cause;
    throw err;
  }
}
