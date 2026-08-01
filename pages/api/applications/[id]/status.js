import { admin as adminApp } from '../../../../lib/firebaseAdmin';
import * as firebaseAdmin from 'firebase-admin';
import { canScheduleInterview, getEmpresaPlanSummary } from '../../../../lib/empresaPlanFeatures';
import { createServerNotification } from '../../../../lib/serverNotifications';

function buildTimelineEvent({ status, notes, interviewDetails, companyName }) {
  const base = {
    date: new Date().toISOString(),
    byType: 'empresa',
    companyName: companyName || 'Empresa'
  };

  if (status === 'analysis') {
    return {
      ...base,
      title: 'Em análise',
      icon: '🔍',
      description: notes ? `A empresa colocou sua candidatura em análise. Nota: ${notes}` : 'A empresa colocou sua candidatura em análise.'
    };
  }
  if (status === 'interview') {
    const when = interviewDetails?.scheduledAt ? new Date(interviewDetails.scheduledAt).toLocaleString('pt-PT') : '';
    const where =
      interviewDetails?.mode === 'presencial'
        ? (interviewDetails.location || 'Local a confirmar')
        : interviewDetails?.mode === 'online'
          ? (interviewDetails.link || 'Link a confirmar')
          : '';
    const extra = interviewDetails?.notes ? ` Observações: ${interviewDetails.notes}` : '';

    return {
      ...base,
      title: 'Entrevista agendada',
      icon: '📅',
      description: `A empresa agendou uma entrevista${when ? ` para ${when}` : ''}.${where ? ` ${interviewDetails.mode === 'presencial' ? 'Local' : 'Link'}: ${where}.` : ''}${extra}`.trim()
    };
  }
  if (status === 'approved') {
    return {
      ...base,
      title: 'Aprovada',
      icon: '✅',
      description: notes ? `A empresa aprovou sua candidatura. Nota: ${notes}` : 'A empresa aprovou sua candidatura.'
    };
  }
  if (status === 'rejected') {
    return {
      ...base,
      title: 'Rejeitada',
      icon: '❌',
      description: notes ? `A empresa rejeitou sua candidatura. Nota: ${notes}` : 'A empresa rejeitou sua candidatura.'
    };
  }
  return {
    ...base,
    title: 'Status atualizado',
    icon: '🔔',
    description: notes ? `Status atualizado para ${status}. Nota: ${notes}` : `Status atualizado para ${status}.`
  };
}

const STATUS_LABELS = {
  pending: 'Pendente',
  analysis: 'Em Analise',
  interview: 'Entrevista',
  approved: 'Aprovado',
  rejected: 'Rejeitado'
};

const STATUS_ICONS = {
  pending: '⏳',
  analysis: '🔍',
  interview: '📅',
  approved: '✅',
  rejected: '❌'
};

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return res.status(405).setHeader('Allow', ['PATCH', 'PUT']).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticacao nao fornecido' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { id } = req.query;
  const { status, notes, interviewDate, interviewMode, interviewLocation, interviewLink, interviewNotes } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID da candidatura e obrigatorio' });
  }

  const validStatuses = ['pending', 'analysis', 'interview', 'approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status invalido. Use: ' + validStatuses.join(', ') });
  }

  try {
    const decodedToken = await adminApp.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Verify user is a company
    const userDoc = await adminApp.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const userData = userDoc.data();
    if (userData.userType !== 'empresa') {
      return res.status(403).json({ error: 'Somente empresas podem atualizar status de candidaturas' });
    }

    if (status === 'interview') {
      const planSummary = getEmpresaPlanSummary(userData);
      const interviewAccess = canScheduleInterview(planSummary.planId);
      if (!interviewAccess.allowed) {
        return res.status(403).json({
          error: interviewAccess.reason,
          code: interviewAccess.code,
          upgradeMessage: interviewAccess.upgradeMessage,
          upgradeUrl: interviewAccess.upgradeUrl
        });
      }
    }

    // Get application
    const applicationRef = adminApp.firestore().collection('applications').doc(id);
    const applicationDoc = await applicationRef.get();
    
    if (!applicationDoc.exists) {
      return res.status(404).json({ error: 'Candidatura nao encontrada' });
    }

    const applicationData = applicationDoc.data();

    // Verify company owns this application (via job)
    if (applicationData.companyId && applicationData.companyId !== uid) {
      return res.status(403).json({ error: 'Voce nao tem permissao para atualizar esta candidatura' });
    }

    const previousStatus = applicationData.status;

    const interviewDetails =
      status === 'interview'
        ? {
            scheduledAt: interviewDate ? new Date(interviewDate).toISOString() : null,
            mode: interviewMode || 'online',
            location: interviewLocation || '',
            link: interviewLink || '',
            notes: interviewNotes || '',
            status: 'scheduled',
          }
        : null;

    if (status === 'interview') {
      if (!interviewDetails.scheduledAt || Number.isNaN(new Date(interviewDetails.scheduledAt).getTime())) {
        return res.status(400).json({ error: 'Informe uma data valida para a entrevista.' });
      }

      if (interviewDetails.mode === 'online' && !interviewDetails.link) {
        return res.status(400).json({ error: 'Informe o link da entrevista online.' });
      }

      if (interviewDetails.mode === 'presencial' && !interviewDetails.location) {
        return res.status(400).json({ error: 'Informe o local da entrevista presencial.' });
      }
    }

    const updateData = {
      status,
      statusUpdatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      statusUpdatedBy: uid
    };

    if (notes) {
      updateData.statusNotes = notes;
    }

    if (interviewDetails) {
      updateData.interviewDetails = {
        ...interviewDetails,
        scheduledBy: uid,
        // When company changes interview details, reset candidate responses.
        confirmedAt: null,
        rescheduleRequestedAt: null,
        rescheduleReason: null,
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      };
    }
    // Append timeline event atomically (avoid lost updates).
    const companyName = userData.name || userData.fullName || userData.companyName || 'Empresa';
    const timelineEvent = buildTimelineEvent({ status, notes, interviewDetails, companyName });

    await adminApp.firestore().runTransaction(async (transaction) => {
      const freshDoc = await transaction.get(applicationRef);
      if (!freshDoc.exists) {
        throw new Error('Candidatura nao encontrada');
      }
      const freshData = freshDoc.data() || {};
      const currentTimeline = Array.isArray(freshData.timeline) ? freshData.timeline : [];
      const nextTimeline = [...currentTimeline, timelineEvent].slice(-40);
      transaction.update(applicationRef, {
        ...updateData,
        timeline: nextTimeline
      });
    });

    // Create notification for candidate
    if (applicationData.candidateId) {
      const interviewDateLabel = interviewDetails?.scheduledAt
        ? new Date(interviewDetails.scheduledAt).toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : null;

      const interviewContext =
        interviewDetails?.mode === 'presencial'
          ? `Local: ${interviewDetails.location}.`
          : interviewDetails?.mode === 'online'
            ? 'Verifique o link enviado pela empresa.'
            : '';

      const notificationMessages = {
        analysis: `Sua candidatura para ${applicationData.jobTitle || 'a vaga'} esta em analise pela empresa.`,
        interview: interviewDateLabel
          ? `Sua entrevista para ${applicationData.jobTitle || 'a vaga'} foi agendada para ${interviewDateLabel}. ${interviewContext}`.trim()
          : `Parabens! Voce foi selecionado para entrevista para ${applicationData.jobTitle || 'a vaga'}. A empresa entrara em contato.`,
        approved: `Parabens! Sua candidatura para ${applicationData.jobTitle || 'a vaga'} foi aprovada!`,
        rejected: `Infelizmente sua candidatura para ${applicationData.jobTitle || 'a vaga'} nao foi aprovada desta vez.`
      };

      if (notificationMessages[status]) {
        try {
          await createServerNotification(adminApp, {
            userId: applicationData.candidateId,
            title: `Candidatura: ${STATUS_LABELS[status]}`,
            message: notificationMessages[status],
            type: 'application_status',
            icon: STATUS_ICONS[status],
            relatedId: id,
            relatedJobId: applicationData.jobId,
            previousStatus,
            newStatus: status,
            interviewDetails: interviewDetails || null,
            actionUrl: '/dashboard/candidato?tab=applications'
          });
        } catch (notifError) {
          logServerError('applications_id_status.criar_notificacao_failed', notifError);
        }
      }
    }

    // Log activity
    await adminApp.firestore().collection('admin_activities').add({
      action: 'update_application_status',
      companyId: uid,
      applicationId: id,
      candidateId: applicationData.candidateId,
      jobId: applicationData.jobId,
      previousStatus,
      newStatus: status,
      notes: notes || null,
      interviewDetails: interviewDetails || null,
      timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ 
      success: true, 
      message: `Status atualizado para ${STATUS_LABELS[status]}`,
      application: {
        id,
        status,
        statusLabel: STATUS_LABELS[status],
        statusNotes: notes || applicationData.statusNotes || null,
        interviewDetails: interviewDetails
          ? {
              ...interviewDetails,
              scheduledBy: uid,
              updatedAt: new Date().toISOString()
            }
          : applicationData.interviewDetails
            ? {
                ...applicationData.interviewDetails,
                scheduledAt: serializeTimestamp(applicationData.interviewDetails.scheduledAt),
                updatedAt: serializeTimestamp(applicationData.interviewDetails.updatedAt)
              }
            : null
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar status da candidatura:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
