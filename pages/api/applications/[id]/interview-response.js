import { admin as adminApp } from '../../../../lib/firebaseAdmin';
import * as firebaseAdmin from 'firebase-admin';
import { sendPushToUser } from '../../../../lib/serverNotifications';
import { logServerError } from '../../../../lib/serverLog';

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function buildCandidateTimelineEvent({ action, reason, interviewDetails }) {
  const base = {
    date: new Date().toISOString(),
    byType: 'candidato',
    icon: action === 'confirm' ? '✅' : '🗓️',
  };

  if (action === 'confirm') {
    const when = interviewDetails?.scheduledAt ? new Date(interviewDetails.scheduledAt).toLocaleString('pt-PT') : '';
    return {
      ...base,
      title: 'Presença confirmada',
      description: when ? `Você confirmou presença para a entrevista em ${when}.` : 'Você confirmou presença para a entrevista.'
    };
  }

  return {
    ...base,
    title: 'Reagendamento solicitado',
    description: reason ? `Você solicitou reagendamento. Motivo: ${reason}` : 'Você solicitou reagendamento da entrevista.'
  };
}

/**
 * POST /api/applications/:id/interview-response
 * body: { action: 'confirm' | 'request_reschedule', reason?: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).setHeader('Allow', ['POST']).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { id } = req.query;
  const { action, reason } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'ID da candidatura é obrigatório' });
  }
  if (!['confirm', 'request_reschedule'].includes(action)) {
    return res.status(400).json({ error: 'Ação inválida' });
  }
  if (action === 'request_reschedule' && typeof reason === 'string' && reason.length > 800) {
    return res.status(400).json({ error: 'Motivo muito longo' });
  }

  let uid;
  try {
    const decoded = await adminApp.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const userDoc = await adminApp.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  const userData = userDoc.data() || {};
  if (userData.userType !== 'candidato') {
    return res.status(403).json({ error: 'Apenas candidatos podem responder à entrevista' });
  }

  const applicationRef = adminApp.firestore().collection('applications').doc(id);

  try {
    const now = firebaseAdmin.firestore.FieldValue.serverTimestamp();

    const result = await adminApp.firestore().runTransaction(async (transaction) => {
      const appDoc = await transaction.get(applicationRef);
      if (!appDoc.exists) {
        return { ok: false, status: 404, error: 'Candidatura não encontrada' };
      }

      const app = appDoc.data() || {};
      if (app.candidateId !== uid) {
        return { ok: false, status: 403, error: 'Sem permissão para esta candidatura' };
      }

      const interviewDetails = app.interviewDetails || null;
      if (!interviewDetails?.scheduledAt) {
        return { ok: false, status: 400, error: 'Esta candidatura não possui entrevista agendada' };
      }

      const currentInterviewStatus = String(interviewDetails.status || 'scheduled').toLowerCase();
      if (action === 'confirm' && currentInterviewStatus === 'confirmed') {
        return { ok: true, already: true, interviewDetails };
      }

      const nextInterviewDetails = {
        ...interviewDetails,
        status: action === 'confirm' ? 'confirmed' : 'reschedule_requested',
        ...(action === 'confirm'
          ? { confirmedAt: now }
          : { rescheduleRequestedAt: now, rescheduleReason: String(reason || '').trim() }),
        candidateRespondedAt: now,
        updatedAt: now,
      };

      const timelineEvent = buildCandidateTimelineEvent({ action, reason: String(reason || '').trim(), interviewDetails });
      const currentTimeline = Array.isArray(app.timeline) ? app.timeline : [];
      const nextTimeline = [...currentTimeline, timelineEvent].slice(-40);

      transaction.update(applicationRef, {
        interviewDetails: nextInterviewDetails,
        timeline: nextTimeline,
        updatedAt: now,
      });

      // Notify company (best effort, but keep in transaction for consistency of createdAt ordering).
      let companyNotification = null;
      if (app.companyId) {
        const notifRef = adminApp.firestore().collection('notifications').doc();
        const title = action === 'confirm' ? 'Entrevista confirmada' : 'Pedido de reagendamento';
        const message =
          action === 'confirm'
            ? `${userData.fullName || userData.name || 'O candidato'} confirmou presença para a entrevista.`
            : `${userData.fullName || userData.name || 'O candidato'} solicitou reagendamento. ${reason ? `Motivo: ${String(reason).trim()}` : ''}`.trim();

        transaction.set(notifRef, {
          userId: app.companyId,
          title,
          message,
          type: 'interview_response',
          icon: action === 'confirm' ? '✅' : '🗓️',
          read: false,
          relatedId: id,
          relatedJobId: app.jobId || null,
          createdAt: now,
        });

        companyNotification = {
          userId: app.companyId,
          title,
          message,
          type: 'interview_response',
          icon: action === 'confirm' ? '✅' : '🗓️',
          relatedId: id,
          actionUrl: '/dashboard/empresa?tab=applications'
        };
      }

      return { ok: true, interviewDetails: nextInterviewDetails, companyNotification };
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.companyNotification?.userId) {
      await sendPushToUser(adminApp, result.companyNotification.userId, result.companyNotification);
    }

    return res.status(200).json({
      success: true,
      interviewDetails: result.interviewDetails
        ? {
            ...result.interviewDetails,
            scheduledAt: serializeTimestamp(result.interviewDetails.scheduledAt),
            updatedAt: serializeTimestamp(result.interviewDetails.updatedAt),
            confirmedAt: serializeTimestamp(result.interviewDetails.confirmedAt),
            rescheduleRequestedAt: serializeTimestamp(result.interviewDetails.rescheduleRequestedAt),
            candidateRespondedAt: serializeTimestamp(result.interviewDetails.candidateRespondedAt),
          }
        : null
    });
  } catch (error) {
    logServerError('applications_id_interview_response.responder_entrevista_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
