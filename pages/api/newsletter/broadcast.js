import { admin } from '../../../lib/firebaseAdmin';
import { sendEmail, isEmailConfigured, getDefaultFrom } from '../../../lib/email';
import { isContentPublished } from '../../../lib/contentPublication';
import { logServerError } from '../../../lib/serverLog';

// Envia um artigo publicado a todos os subscritores da newsletter.
// Só admins podem disparar. Protegido contra reenvio pelo campo
// `newsletterSentAt` gravado no próprio artigo (envia uma única vez).

const BCC_BATCH = 80; // recipientes por mensagem (limites do Gmail)

function baseUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : '';
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function announcementEmail({ post, postId, site }) {
  const url = `${site}/blog/${postId}`;
  const title = escapeHtml(post.title || 'Novo artigo');
  const excerpt = escapeHtml(post.excerpt || '');
  const cover = typeof post.coverImage === 'string' && /^https?:\/\//.test(post.coverImage)
    ? post.coverImage
    : '';

  const html = `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:22px 24px;background:linear-gradient(135deg,#14264f,#0c1834);border-radius:16px 16px 0 0;">
              <div style="color:#d9ff3f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">EmpregoSTP · Newsletter</div>
              <div style="margin-top:6px;color:#ffffff;font-size:14px;">Novo artigo publicado</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;background:#ffffff;">
              ${cover ? `<img src="${cover}" alt="" style="display:block;width:100%;max-height:240px;object-fit:cover;" />` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px;background:#ffffff;border-radius:0 0 16px 16px;">
              <h1 style="margin:0 0 10px;color:#14264f;font-size:20px;font-weight:800;line-height:1.3;">${title}</h1>
              ${excerpt ? `<p style="margin:0 0 16px;color:#3b4a66;font-size:15px;line-height:1.6;">${excerpt}</p>` : ''}
              <a href="${url}" style="display:inline-block;padding:12px 20px;background:#2f6edb;color:#ffffff;border-radius:9px;font-size:14px;font-weight:600;text-decoration:none;">Ler artigo completo →</a>
              <div style="margin-top:22px;padding-top:16px;border-top:1px solid #eef2f8;color:#9aa7bf;font-size:11px;line-height:1.6;">
                Recebeste este email porque subscreveste a newsletter do EmpregoSTP.
              </div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `Novo artigo no EmpregoSTP\n\n${post.title || 'Novo artigo'}\n${post.excerpt || ''}\n\nLer: ${url}`;

  return { subject: `📰 ${post.title || 'Novo artigo'} — EmpregoSTP`, html, text };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // 1) Autenticação: só admins.
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Não autorizado' });

    let uid;
    try {
      uid = (await admin.auth().verifyIdToken(token)).uid;
    } catch {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem enviar a newsletter.' });
    }

    // 2) Artigo (blog -> posts, noticias -> news). Ambos aparecem em /blog/[id].
    const COLLECTIONS = { blog: 'posts', news: 'news' };
    const type = COLLECTIONS[req.body?.type] ? req.body.type : 'blog';
    const collectionName = COLLECTIONS[type];

    const postId = String(req.body?.postId || '').trim();
    if (!postId) return res.status(400).json({ error: 'postId em falta' });

    const postRef = admin.firestore().collection(collectionName).doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return res.status(404).json({ error: 'Artigo não encontrado' });

    const post = postSnap.data() || {};
    if (!isContentPublished(post.status)) {
      return res.status(400).json({ error: 'O artigo não está publicado.' });
    }

    // 3) Guarda contra reenvio.
    if (post.newsletterSentAt) {
      return res.status(200).json({ alreadySent: true, sent: 0 });
    }

    // 4) Subscritores ativos.
    const subsSnap = await admin
      .firestore()
      .collection('newsletterSubscribers')
      .where('active', '==', true)
      .get();

    const emails = [
      ...new Set(
        subsSnap.docs
          .map((doc) => String(doc.data()?.email || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    if (emails.length === 0) {
      await postRef.set(
        { newsletterSentAt: admin.firestore.FieldValue.serverTimestamp(), newsletterRecipients: 0 },
        { merge: true },
      );
      return res.status(200).json({ sent: 0, message: 'Ainda não há subscritores.' });
    }

    if (!isEmailConfigured()) {
      return res.status(202).json({
        sent: 0,
        emailSent: false,
        message: 'Serviço de email não configurado — a newsletter não foi enviada.',
      });
    }

    // 5) Enviar em lotes por BCC (mantém os emails privados).
    const { subject, html, text } = announcementEmail({ post, postId, site: baseUrl(req) });
    let sent = 0;
    for (const batch of chunk(emails, BCC_BATCH)) {
      await sendEmail({ to: getDefaultFrom(), bcc: batch, subject, html, text });
      sent += batch.length;
    }

    // 6) Marcar como enviado.
    await postRef.set(
      {
        newsletterSentAt: admin.firestore.FieldValue.serverTimestamp(),
        newsletterRecipients: sent,
      },
      { merge: true },
    );

    return res.status(200).json({ sent, message: `Newsletter enviada a ${sent} subscritor(es).` });
  } catch (error) {
    logServerError('newsletter_broadcast.enviar_newsletter_failed', error);
    return res.status(500).json({ error: 'Não foi possível enviar a newsletter.' });
  }
}
