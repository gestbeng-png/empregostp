import { admin } from '../../../lib/firebaseAdmin';
import {
  sendEmail,
  isEmailConfigured,
  getDefaultFrom,
} from '../../../lib/email';
import { announcementEmail } from '../../../lib/newsletterEmails';
import { isContentPublished } from '../../../lib/contentPublication';
import { logServerError } from '../../../lib/serverLog';

// Envia um artigo publicado a todos os subscritores da newsletter.
// Só admins podem disparar. Protegido contra reenvio pelo campo
// `newsletterSentAt` gravado no próprio artigo (envia uma única vez).

const BCC_BATCH = 80; // recipientes por mensagem
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
      return res
        .status(403)
        .json({ error: 'Apenas administradores podem enviar a newsletter.' });
    }

    // 2) Artigo (blog -> posts, noticias -> news). Ambos aparecem em /blog/[id].
    const COLLECTIONS = { blog: 'posts', news: 'news' };
    const type = COLLECTIONS[req.body?.type] ? req.body.type : 'blog';
    const collectionName = COLLECTIONS[type];

    const postId = String(req.body?.postId || '').trim();
    if (!postId) return res.status(400).json({ error: 'postId em falta' });

    const postRef = admin.firestore().collection(collectionName).doc(postId);
    // Uma notícia não é um artigo: as mensagens seguem o tipo enviado.
    const noticia = type === 'news';

    const postSnap = await postRef.get();
    if (!postSnap.exists) {
      return res.status(404).json({
        error: noticia ? 'Notícia não encontrada.' : 'Artigo não encontrado.',
      });
    }

    const post = postSnap.data() || {};
    if (!isContentPublished(post.status)) {
      return res.status(400).json({
        error: noticia
          ? 'A notícia não está publicada.'
          : 'O artigo não está publicado.',
      });
    }

    // 3) Guarda contra reenvio.
    if (post.newsletterSentAt) {
      return res.status(200).json({ alreadySent: true, sent: 0 });
    }

    // 4) Destinatários: subscritores da newsletter + utilizadores registados.
    //
    // Os utilizadores não subscreveram explicitamente a newsletter, por isso
    // respeita-se a preferência de notificações que já governa os avisos de
    // vagas: quem a desligou não recebe. Ausente significa "nunca mexeu" e
    // conta como activa, tal como em lib/newJobBroadcast.js.
    const [subsSnap, usersSnap] = await Promise.all([
      admin
        .firestore()
        .collection('newsletterSubscribers')
        .where('active', '==', true)
        .get(),
      admin.firestore().collection('users').get(),
    ]);

    const destinatarios = new Set(
      subsSnap.docs
        .map((doc) =>
          String(doc.data()?.email || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );

    let ignoradosPorPreferencia = 0;
    usersSnap.docs.forEach((doc) => {
      const dados = doc.data() || {};
      const email = String(dados.email || '')
        .trim()
        .toLowerCase();
      if (!EMAIL_VALIDO.test(email)) return;
      if (dados?.settings?.notifications?.jobAlerts === false) {
        ignoradosPorPreferencia += 1;
        return;
      }
      destinatarios.add(email);
    });

    const emails = [...destinatarios];

    if (emails.length === 0) {
      await postRef.set(
        {
          newsletterSentAt: admin.firestore.FieldValue.serverTimestamp(),
          newsletterRecipients: 0,
        },
        { merge: true },
      );
      return res
        .status(200)
        .json({ sent: 0, message: 'Não há destinatários.' });
    }

    if (!isEmailConfigured()) {
      return res.status(202).json({
        sent: 0,
        emailSent: false,
        message:
          'Serviço de email não configurado — a newsletter não foi enviada.',
      });
    }

    // 5) Enviar em lotes por BCC (mantém os emails privados).
    const { subject, html, text } = announcementEmail({
      post,
      postId,
      type,
      site: baseUrl(req),
    });
    let sent = 0;
    for (const batch of chunk(emails, BCC_BATCH)) {
      await sendEmail({
        to: getDefaultFrom(),
        bcc: batch,
        subject,
        html,
        text,
      });
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

    return res.status(200).json({
      sent,
      skipped: ignoradosPorPreferencia,
      message:
        `Newsletter enviada a ${sent} destinatário(s).` +
        (ignoradosPorPreferencia
          ? ` ${ignoradosPorPreferencia} não receberam por terem desligado as notificações.`
          : ''),
    });
  } catch (error) {
    logServerError('newsletter_broadcast.enviar_newsletter_failed', error);
    return res
      .status(500)
      .json({ error: 'Não foi possível enviar a newsletter.' });
  }
}
