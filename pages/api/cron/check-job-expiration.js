import { admin } from '../../../lib/firebaseAdmin';
import { buildExpiredJobUpdate, isJobExpired } from '../../../lib/jobExpiration';
import { createServerNotification } from '../../../lib/serverNotifications';
import { logServerError } from '../../../lib/serverLog';

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers.authorization?.split('Bearer ')[1];

  if (!cronSecret || providedSecret !== cronSecret) {
    return res.status(401).json({
      error: 'Unauthorized - Invalid cron secret',
      message: 'Set CRON_SECRET environment variable'
    });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const now = new Date();
    const snapshot = await admin.firestore()
      .collection('jobs')
      .where('status', '==', 'active')
      .get();

    const expiredDocs = snapshot.docs.filter((doc) => isJobExpired(doc.data(), now));
    let updated = 0;
    let notificationErrors = 0;

    if (expiredDocs.length > 0) {
      const batch = admin.firestore().batch();
      expiredDocs.forEach((doc) => {
        batch.update(doc.ref, buildExpiredJobUpdate(admin, now));
      });
      await batch.commit();
      updated = expiredDocs.length;
    }

    for (const doc of expiredDocs) {
      try {
        const job = doc.data();
        if (!job.companyId) continue;

        await createServerNotification(admin, {
          userId: job.companyId,
          type: 'job_expired',
          title: 'Vaga fechada automaticamente',
          message: `A vaga "${job.titulo || 'Sem titulo'}" foi fechada automaticamente porque a data de fecho expirou.`,
          actionUrl: `/dashboard/empresa/vaga/${doc.id}`
        });
      } catch (error) {
        notificationErrors += 1;
        logServerError('cron_check_job_expiration.criar_notificacao_de_vaga_expirada_failed', error);
      }
    }

    return res.status(200).json({
      success: true,
      message: `${updated} vaga(s) expirada(s) fechada(s) automaticamente`,
      stats: {
        scanned: snapshot.size,
        expired: expiredDocs.length,
        updated,
        notificationErrors
      },
      timestamp: now.toISOString()
    });
  } catch (error) {
    logServerError('cron_check_job_expiration.job_expiration_check_failed', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
