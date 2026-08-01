import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';
import { sendEmail, isEmailConfigured } from '../../../lib/email';
import { logServerError } from '../../../lib/serverLog';

// Recebe mensagens do formulário público de contacto.
// As mensagens ficam guardadas em `contactMessages` e, quando o email estiver
// configurado, uma notificação é enviada para a caixa de suporte com o
// `replyTo` do remetente, para responder diretamente.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_INBOX = process.env.CONTACT_INBOX || 'suporte@empregos.st';

const SUBJECTS = new Set([
  'candidato',
  'empresa',
  'suporte',
  'parceria',
  'outro',
]);

const SUBJECT_LABEL = {
  candidato: 'Sou candidato',
  empresa: 'Sou empresa',
  suporte: 'Apoio / conta',
  parceria: 'Parceria ou imprensa',
  outro: 'Outro assunto',
};

function sanitize(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function sanitizeMessage(value, max = 4000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function notificationEmail({ name, email, phone, subjectLabel, message }) {
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
  const html = `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:24px;background:linear-gradient(135deg,#14264f,#0c1834);border-radius:16px 16px 0 0;">
              <div style="color:#d9ff3f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">EmpregoSTP · Contacto</div>
              <div style="margin-top:8px;color:#ffffff;font-size:21px;font-weight:800;">Nova mensagem de contacto</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px;background:#ffffff;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 6px;color:#0f1b34;font-size:15px;font-weight:700;">${escapeHtml(name)}</p>
              <p style="margin:0 0 4px;color:#3b4a66;font-size:14px;">Email: <a href="mailto:${escapeHtml(email)}" style="color:#2f6edb;">${escapeHtml(email)}</a></p>
              ${phone ? `<p style="margin:0 0 4px;color:#3b4a66;font-size:14px;">Telefone: ${escapeHtml(phone)}</p>` : ''}
              <p style="margin:0 0 16px;color:#3b4a66;font-size:14px;">Assunto: ${escapeHtml(subjectLabel)}</p>
              <div style="padding:16px;background:#f4f7fc;border-radius:12px;color:#0f1b34;font-size:14px;line-height:1.6;">${safeMessage}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Nova mensagem de contacto\n\nNome: ${name}\nEmail: ${email}\n${phone ? `Telefone: ${phone}\n` : ''}Assunto: ${subjectLabel}\n\n${message}`;

  return {
    subject: `Contacto EmpregoSTP · ${subjectLabel} — ${name}`,
    html,
    text,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (!(await enforceApiRateLimit(req, res, { scope: 'contact', limit: 5 }))) {
    return;
  }

  try {
    const name = sanitize(req.body?.name, 80);
    const email = sanitize(req.body?.email, 160).toLowerCase();
    const phone = sanitize(req.body?.phone, 40);
    const rawSubject = sanitize(req.body?.subject, 20).toLowerCase();
    const subject = SUBJECTS.has(rawSubject) ? rawSubject : 'outro';
    const message = sanitizeMessage(req.body?.message);

    if (name.length < 2) {
      return res.status(400).json({ error: 'Indique o seu nome.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Introduza um email válido.' });
    }
    if (message.length < 10) {
      return res
        .status(400)
        .json({ error: 'Escreva uma mensagem com pelo menos 10 caracteres.' });
    }

    const subjectLabel = SUBJECT_LABEL[subject] || SUBJECT_LABEL.outro;

    await admin
      .firestore()
      .collection('contactMessages')
      .add({
        name,
        email,
        phone: phone || null,
        subject,
        subjectLabel,
        message,
        status: 'new',
        source: sanitize(req.body?.source, 40) || 'contacto',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: req.headers['user-agent'] || null,
        ip: getClientIp(req),
      });

    if (isEmailConfigured()) {
      const {
        subject: mailSubject,
        html,
        text,
      } = notificationEmail({
        name,
        email,
        phone,
        subjectLabel,
        message,
      });
      try {
        await sendEmail({
          to: SUPPORT_INBOX,
          replyTo: email,
          subject: mailSubject,
          html,
          text,
        });
      } catch (emailError) {
        logServerError('contact.notificar_contacto_por_email_failed', emailError);
        return res.status(202).json({
          message:
            'Mensagem recebida! A nossa equipa vai responder assim que possível.',
          emailSent: false,
        });
      }
    }

    return res.status(201).json({
      message:
        'Mensagem enviada! A nossa equipa entra em contacto o mais breve possível.',
      emailSent: isEmailConfigured(),
    });
  } catch (error) {
    logServerError('contact.registar_mensagem_de_contacto_failed', error);
    return res
      .status(500)
      .json({ error: 'Não foi possível enviar a mensagem. Tente novamente.' });
  }
}
