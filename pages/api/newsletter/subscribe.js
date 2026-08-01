import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';
import { sendEmail, isEmailConfigured } from '../../../lib/email';
import { logServerError } from '../../../lib/serverLog';

// Regista subscritores da newsletter e envia um email de boas-vindas.
// Os subscritores ficam em `newsletterSubscribers` e podem depois ser usados
// para enviar novidades/artigos em massa.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : '';
}

function sanitize(value, max = 60) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function welcomeEmail({ site }) {
  const html = `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:24px;background:linear-gradient(135deg,#14264f,#0c1834);border-radius:16px 16px 0 0;">
              <div style="color:#d9ff3f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">EmpregoSTP · Newsletter</div>
              <div style="margin-top:8px;color:#ffffff;font-size:21px;font-weight:800;">Subscrição confirmada 🎉</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px;background:#ffffff;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 12px;color:#3b4a66;font-size:15px;line-height:1.6;">
                Obrigado por subscreveres a newsletter do <b>EmpregoSTP</b>! A partir de agora vais receber
                novidades, dicas de carreira e novos artigos sobre o mercado de trabalho em São Tomé e Príncipe,
                diretamente no teu email.
              </p>
              <div style="margin:18px 0 4px;">
                <a href="${site}/blog" style="display:inline-block;padding:11px 18px;background:#2f6edb;color:#ffffff;border-radius:9px;font-size:14px;font-weight:600;text-decoration:none;">Ver os artigos mais recentes →</a>
              </div>
              <div style="margin-top:22px;padding-top:16px;border-top:1px solid #eef2f8;color:#9aa7bf;font-size:11px;line-height:1.6;">
                Recebeste este email porque subscreveste a newsletter em ${site || 'EmpregoSTP'}.
              </div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Subscrição confirmada!\n\nObrigado por subscreveres a newsletter do EmpregoSTP. Vais receber novidades, dicas de carreira e novos artigos no teu email.\n\nVer artigos: ${site}/blog`;

  return { subject: 'Bem-vindo à newsletter do EmpregoSTP 🎉', html, text };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
    const subscribersRef = admin.firestore().collection('newsletterSubscribers');

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
          ? existing.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
          : admin.firestore.FieldValue.serverTimestamp(),
        resubscribedAt: existing.exists ? admin.firestore.FieldValue.serverTimestamp() : null,
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
        logServerError('newsletter_subscribe.enviar_email_de_boas_vindas_da_newsletter_failed', emailError);
        return res.status(202).json({
          message: 'Subscrição registada! (O email de confirmação será enviado em breve.)',
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
    return res.status(500).json({ error: 'Não foi possível concluir a subscrição.' });
  }
}
