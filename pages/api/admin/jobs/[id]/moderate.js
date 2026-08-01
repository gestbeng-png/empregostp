import { admin } from '../../../../../lib/firebaseAdmin';
import { isEmailConfigured, sendEmail } from '../../../../../lib/email';
import { parseJobCloseDate } from '../../../../../lib/jobExpiration';
import {
  JOB_STATUS_PENDING_REVIEW,
  JOB_STATUS_REJECTED,
} from '../../../../../lib/jobModeration';
import { logServerError, logServerWarning } from '../../../../../lib/serverLog';
import { createServerNotification } from '../../../../../lib/serverNotifications';

const MAX_REASON_LENGTH = 500;

function sanitizeReason(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_REASON_LENGTH);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decisionEmail({ approved, jobTitle, reason }) {
  const heading = approved ? 'Vaga aprovada 🎉' : 'Vaga não aprovada';
  const body = approved
    ? `A sua vaga <b>${escapeHtml(jobTitle)}</b> foi aprovada e já está publicada no EmpregoSTP. Os candidatos podem começar a candidatar-se.`
    : `A sua vaga <b>${escapeHtml(jobTitle)}</b> não foi aprovada pela equipa de moderação.${reason ? ` Motivo: ${escapeHtml(reason)}.` : ''} Pode editar a vaga e submetê-la novamente.`;
  const html = `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:24px;background:linear-gradient(135deg,#14264f,#0c1834);border-radius:16px 16px 0 0;">
              <div style="color:#d9ff3f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">EmpregoSTP · Vagas</div>
              <div style="margin-top:8px;color:#ffffff;font-size:21px;font-weight:800;">${heading}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px;background:#ffffff;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 12px;color:#3b4a66;font-size:15px;line-height:1.6;">${body}</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = approved
    ? `A sua vaga "${jobTitle}" foi aprovada e já está publicada no EmpregoSTP.`
    : `A sua vaga "${jobTitle}" não foi aprovada.${reason ? ` Motivo: ${reason}.` : ''} Pode editar a vaga e submetê-la novamente.`;

  return {
    subject: approved
      ? `Vaga aprovada: ${jobTitle} — EmpregoSTP`
      : `Vaga não aprovada: ${jobTitle} — EmpregoSTP`,
    html,
    text,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const adminDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
    }

    const { action } = req.body || {};
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ message: 'Ação inválida. Use approve ou reject.' });
    }
    const reason = sanitizeReason(req.body?.reason);

    const { id } = req.query;
    const jobRef = admin.firestore().collection('jobs').doc(id);
    const now = admin.firestore.Timestamp.now();

    let jobData = null;
    try {
      await admin.firestore().runTransaction(async (transaction) => {
        const jobDoc = await transaction.get(jobRef);
        if (!jobDoc.exists) {
          const error = new Error('Vaga não encontrada');
          error.code = 'JOB_NOT_FOUND';
          throw error;
        }

        jobData = jobDoc.data();
        if (jobData.status !== JOB_STATUS_PENDING_REVIEW) {
          const error = new Error('Esta vaga já foi processada');
          error.code = 'JOB_ALREADY_MODERATED';
          throw error;
        }

        if (action === 'approve') {
          const closeDate = parseJobCloseDate(jobData.dataFecho || jobData.expiresAt);
          if (closeDate && closeDate.getTime() < now.toDate().getTime()) {
            const error = new Error('A vaga expirou antes da aprovação. Peça à empresa para atualizar a data de fecho.');
            error.code = 'JOB_EXPIRED_BEFORE_APPROVAL';
            throw error;
          }

          transaction.update(jobRef, {
            status: 'active',
            publishedAt: now,
            moderatedAt: now,
            moderatedBy: decodedToken.uid,
            moderationDecision: 'approved',
            moderationReason: null,
            updatedAt: now,
          });
        } else {
          transaction.update(jobRef, {
            status: JOB_STATUS_REJECTED,
            moderatedAt: now,
            moderatedBy: decodedToken.uid,
            moderationDecision: 'rejected',
            moderationReason: reason || null,
            updatedAt: now,
          });
        }
      });
    } catch (transactionError) {
      if (transactionError?.code === 'JOB_NOT_FOUND') {
        return res.status(404).json({ message: transactionError.message });
      }
      if (
        transactionError?.code === 'JOB_ALREADY_MODERATED'
        || transactionError?.code === 'JOB_EXPIRED_BEFORE_APPROVAL'
      ) {
        return res.status(409).json({ message: transactionError.message });
      }
      throw transactionError;
    }

    const approved = action === 'approve';
    const jobTitle = jobData?.titulo || 'Sem título';

    await admin.firestore().collection('activities').add({
      type: approved ? 'job_approved' : 'job_rejected',
      description: approved
        ? `Vaga "${jobTitle}" foi aprovada e publicada`
        : `Vaga "${jobTitle}" foi rejeitada${reason ? ` (motivo: ${reason})` : ''}`,
      jobId: id,
      adminId: decodedToken.uid,
      companyId: jobData?.companyId || null,
      createdAt: new Date().toISOString(),
    });

    // Notificação in-app + push e email à empresa; falhas de entrega não
    // revertem a decisão já persistida.
    if (jobData?.companyId) {
      try {
        await createServerNotification(admin, {
          userId: jobData.companyId,
          type: approved ? 'JOB_APPROVED' : 'JOB_REJECTED',
          title: approved ? 'Vaga aprovada' : 'Vaga não aprovada',
          message: approved
            ? `A sua vaga "${jobTitle}" foi aprovada e já está publicada.`
            : `A sua vaga "${jobTitle}" não foi aprovada.${reason ? ` Motivo: ${reason}` : ''}`,
          icon: approved ? '✅' : '⛔',
          relatedId: id,
          relatedType: 'job',
          actionUrl: '/dashboard/empresa?tab=jobs',
        });
      } catch (notificationError) {
        logServerWarning('jobs.moderation_notification_failed', notificationError);
      }

      if (isEmailConfigured()) {
        try {
          const companyDoc = await admin.firestore().collection('users').doc(jobData.companyId).get();
          const companyEmail = companyDoc.exists ? companyDoc.data()?.email : null;
          if (companyEmail) {
            await sendEmail({
              to: companyEmail,
              ...decisionEmail({ approved, jobTitle, reason }),
            });
          }
        } catch (emailError) {
          logServerWarning('jobs.moderation_email_failed', emailError);
        }
      }
    }

    return res.status(200).json({
      message: approved ? 'Vaga aprovada e publicada' : 'Vaga rejeitada',
      id,
      status: approved ? 'active' : JOB_STATUS_REJECTED,
    });
  } catch (error) {
    logServerError('jobs.moderation_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
