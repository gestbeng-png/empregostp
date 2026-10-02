import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';
import { sendEmail, isEmailConfigured } from '../../../lib/email';
import { logServerError } from '../../../lib/serverLog';
import { notificationEmail } from '../../../lib/contactEmails';

// Recebe mensagens do formulário público de contacto.
// As mensagens ficam guardadas em `contactMessages` e, quando o email estiver
// configurado, uma notificação é enviada para a caixa de suporte com o
// `replyTo` do remetente, para responder diretamente.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_INBOX = process.env.CONTACT_INBOX || 'contacto@empregostp.com';

const SUBJECTS = new Set([
  'candidato',
  'empresa',
  'suporte',
  'parceria',
  'carreira',
  'outro',
]);

const SUBJECT_LABEL = {
  candidato: 'Sou candidato',
  empresa: 'Sou empresa',
  suporte: 'Apoio / conta',
  parceria: 'Parceria ou imprensa',
  carreira: 'Quer juntar-se à equipa',
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
        subject,
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
        logServerError(
          'contact.notificar_contacto_por_email_failed',
          emailError,
        );
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
