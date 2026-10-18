import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';
import { sendEmail, isEmailConfigured } from '../../../lib/email';
import { welcomeEmail } from '../../../lib/email/newsletterEmails';
import { logServerError } from '../../../lib/serverLog';

// Regista subscritores da newsletter e envia um email de boas-vindas.
// Os subscritores ficam em `newsletterSubscribers` e podem depois ser usados
// para enviar novidades/artigos em massa.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] || 'https')
    .split(',')[0]
    .trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : '';
}

function sanitize(value, max = 60) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (
    !(await enforceApiRateLimit(req, res, {
      scope: 'newsletter_subscribe',
      limit: 5,
    }))
  ) {
    return;
  }

  try {
    const email = sanitize(req.body?.email, 160).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Introduza um email válido.' });
    }

    const source = sanitize(req.body?.source, 40) || 'site';
    const subscribersRef = admin
      .firestore()
      .collection('newsletterSubscribers');

    // Evitar duplicados: usar o email como id do documento.
    const docId = email.replace(/[^a-z0-9]/g, '_');
    const docRef = subscribersRef.doc(docId);
    const existing = await docRef.get();

    if (existing.exists && existing.data()?.active) {
      return res.status(200).json({
        message: 'Este email já está subscrito. Obrigado!',
        alreadySubscribed: true,
      });
    }

    await docRef.set(
      {
        email,
        active: true,
        source,
        createdAt: existing.exists
          ? existing.data()?.createdAt ||
            admin.firestore.FieldValue.serverTimestamp()
          : admin.firestore.FieldValue.serverTimestamp(),
        resubscribedAt: existing.exists
          ? admin.firestore.FieldValue.serverTimestamp()
          : null,
        userAgent: req.headers['user-agent'] || null,
        ip: getClientIp(req),
      },
      { merge: true },
    );

    // Enviar email de boas-vindas (não bloqueia a subscrição se falhar).
    if (isEmailConfigured()) {
      const { subject, html, text } = welcomeEmail({ site: baseUrl(req) });
      try {
        await sendEmail({ to: email, subject, html, text });
      } catch (emailError) {
        logServerError(
          'newsletter_subscribe.enviar_email_de_boas_vindas_da_newsletter_failed',
          emailError,
        );
        return res.status(202).json({
          message:
            'Subscrição registada! (O email de confirmação será enviado em breve.)',
          emailSent: false,
        });
      }
    } else {
      return res.status(202).json({
        message: 'Subscrição registada! Obrigado.',
        emailSent: false,
      });
    }

    return res.status(201).json({
      message: 'Subscrição confirmada! Enviámos-te um email de boas-vindas.',
      emailSent: true,
    });
  } catch (error) {
    logServerError('newsletter_subscribe.subscrever_newsletter_failed', error);
    return res
      .status(500)
      .json({ error: 'Não foi possível concluir a subscrição.' });
  }
}
