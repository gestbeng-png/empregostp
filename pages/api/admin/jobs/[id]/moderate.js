import { admin } from '../../../../../lib/firebaseAdmin';
import { isEmailConfigured, sendEmail } from '../../../../../lib/email';
import { decisionEmail } from '../../../../../lib/email/jobModerationEmail';
import { parseJobCloseDate } from '../../../../../lib/jobExpiration';
import {
  JOB_STATUS_PENDING_REVIEW,
  JOB_STATUS_REJECTED,
} from '../../../../../lib/jobModeration';
import { logServerError, logServerWarning } from '../../../../../lib/serverLog';
import { createServerNotification } from '../../../../../lib/serverNotifications';
import { broadcastNewJob } from '../../../../../lib/newJobBroadcast';

const MAX_REASON_LENGTH = 500;

function sanitizeReason(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REASON_LENGTH);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin
      .auth()
      .verifyIdToken(authHeader.split('Bearer ')[1]);
    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Acesso negado. Apenas administradores.' });
    }

    const { action } = req.body || {};
    if (action !== 'approve' && action !== 'reject') {
      return res
        .status(400)
        .json({ message: 'Ação inválida. Use approve ou reject.' });
    }
    const reason = sanitizeReason(req.body?.reason);

    const { id } = req.query;
    const jobRef = admin.firestore().collection('jobs').doc(id);
    // Só alocado para vagas v2; uma vez, não em cada nova tentativa.
    let historyRef = null;
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

        // D7: vagas já com estado v2 (backfill ou ocultação por denúncia)
        // mudam os dois estados e o histórico na mesma transação.
        const lifecycleUpdate = (to) => {
          if (typeof jobData.v2Status !== 'string') return {};
          const version =
            (Number.isSafeInteger(jobData.version) ? jobData.version : 0) + 1;
          historyRef ||= admin
            .firestore()
            .collection('jobsStatusHistory')
            .doc();
          transaction.create(historyRef, {
            entityId: id,
            from: jobData.v2Status,
            to,
            actorId: decodedToken.uid,
            actorType: 'ADMIN',
            reason: to === 'REJECTED' ? reason || null : null,
            at: now,
            version,
          });
          return { v2Status: to, version, updatedBy: decodedToken.uid };
        };

        if (action === 'approve') {
          const closeDate = parseJobCloseDate(
            jobData.dataFecho || jobData.expiresAt,
          );
          if (closeDate && closeDate.getTime() < now.toDate().getTime()) {
            const error = new Error(
              'A vaga expirou antes da aprovação. Peça à empresa para atualizar a data de fecho.',
            );
            error.code = 'JOB_EXPIRED_BEFORE_APPROVAL';
            throw error;
          }

          transaction.update(jobRef, {
            ...lifecycleUpdate('PUBLISHED'),
            status: 'active',
            // Vaga ocultada por denúncias e reaprovada mantém a data original;
            // o resto mantém o comportamento anterior.
            publishedAt:
              jobData.autoHiddenAt && jobData.publishedAt
                ? jobData.publishedAt
                : now,
            moderatedAt: now,
            moderatedBy: decodedToken.uid,
            moderationDecision: 'approved',
            moderationReason: null,
            updatedAt: now,
          });
        } else {
          transaction.update(jobRef, {
            ...lifecycleUpdate('REJECTED'),
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
        transactionError?.code === 'JOB_ALREADY_MODERATED' ||
        transactionError?.code === 'JOB_EXPIRED_BEFORE_APPROVAL'
      ) {
        return res.status(409).json({ message: transactionError.message });
      }
      throw transactionError;
    }

    const approved = action === 'approve';
    const jobTitle = jobData?.titulo || 'Sem título';

    // Aprovar em moderação é o momento em que a vaga passa a ser pública, pelo
    // que é aqui que os candidatos devem ser avisados — e não na criação, que
    // nesse fluxo apenas a deixou pendente.
    if (approved) {
      try {
        const publicada = await admin
          .firestore()
          .collection('jobs')
          .doc(id)
          .get();
        await broadcastNewJob(admin, {
          job: publicada.data(),
          jobId: id,
          req,
        });
      } catch (broadcastError) {
        logServerWarning('jobs.moderation_broadcast_failed', broadcastError);
      }
    }

    await admin
      .firestore()
      .collection('activities')
      .add({
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
        logServerWarning(
          'jobs.moderation_notification_failed',
          notificationError,
        );
      }

      if (isEmailConfigured()) {
        try {
          const companyDoc = await admin
            .firestore()
            .collection('users')
            .doc(jobData.companyId)
            .get();
          const companyEmail = companyDoc.exists
            ? companyDoc.data()?.email
            : null;
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
