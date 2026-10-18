import { admin as adminApp } from '../../../../lib/firebaseAdmin';
import * as firebaseAdmin from 'firebase-admin';
import {
  canScheduleInterview,
  getEmpresaPlanSummary,
} from '../../../../lib/empresaPlanFeatures';
import { createServerNotification } from '../../../../lib/serverNotifications';
import { resolveApplicationCompanyId } from '../../../../lib/applicationOwnership';
import { isAdminPublishedJob } from '../../../../lib/adminJobManagement';
import { normalizeDateValue } from '../../../../lib/dateValue';
import { logServerError } from '../../../../lib/serverLog';
import { recordActivity } from '../../../../lib/activityLog';
import {
  LEGACY_ATS_REASON,
  planLegacyAtsTransition,
} from '../../../../domain/applications/legacyAts';

function buildTimelineEvent({
  status,
  notes,
  interviewDetails,
  companyName,
  actorType = 'empresa',
}) {
  const actorLabel =
    actorType === 'admin' ? 'A administração da vaga' : 'A empresa';
  const base = {
    date: new Date().toISOString(),
    byType: actorType,
    companyName: companyName || 'Empresa',
  };

  if (status === 'analysis') {
    return {
      ...base,
      title: 'Em análise',
      icon: '🔍',
      description: notes
        ? `${actorLabel} colocou sua candidatura em análise. Nota: ${notes}`
        : `${actorLabel} colocou sua candidatura em análise.`,
    };
  }
  if (status === 'interview') {
    const when = interviewDetails?.scheduledAt
      ? new Date(interviewDetails.scheduledAt).toLocaleString('pt-PT')
      : '';
    const where =
      interviewDetails?.mode === 'presencial'
        ? interviewDetails.location || 'Local a confirmar'
        : interviewDetails?.mode === 'online'
          ? interviewDetails.link || 'Link a confirmar'
          : '';
    const extra = interviewDetails?.notes
      ? ` Observações: ${interviewDetails.notes}`
      : '';

    return {
      ...base,
      title: 'Entrevista agendada',
      icon: '📅',
      description:
        `${actorLabel} agendou uma entrevista${when ? ` para ${when}` : ''}.${where ? ` ${interviewDetails.mode === 'presencial' ? 'Local' : 'Link'}: ${where}.` : ''}${extra}`.trim(),
    };
  }
  if (status === 'approved') {
    return {
      ...base,
      title: 'Aprovada',
      icon: '✅',
      description: notes
        ? `${actorLabel} aprovou sua candidatura. Nota: ${notes}`
        : `${actorLabel} aprovou sua candidatura.`,
    };
  }
  if (status === 'rejected') {
    return {
      ...base,
      title: 'Rejeitada',
      icon: '❌',
      description: notes
        ? `${actorLabel} rejeitou sua candidatura. Nota: ${notes}`
        : `${actorLabel} rejeitou sua candidatura.`,
    };
  }
  return {
    ...base,
    title: 'Status atualizado',
    icon: '🔔',
    description: notes
      ? `Status atualizado para ${status}. Nota: ${notes}`
      : `Status atualizado para ${status}.`,
  };
}

const STATUS_LABELS = {
  pending: 'Pendente',
  analysis: 'Em Analise',
  interview: 'Entrevista',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

const STATUS_ICONS = {
  pending: '⏳',
  analysis: '🔍',
  interview: '📅',
  approved: '✅',
  rejected: '❌',
};

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

function applicationStatusError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return res
      .status(405)
      .setHeader('Allow', ['PATCH', 'PUT'])
      .json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Token de autenticacao nao fornecido' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { id } = req.query;
  const {
    status,
    notes,
    interviewDate,
    interviewMode,
    interviewLocation,
    interviewLink,
    interviewNotes,
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID da candidatura e obrigatorio' });
  }

  const validStatuses = [
    'pending',
    'analysis',
    'interview',
    'approved',
    'rejected',
  ];
  if (!status || !validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ error: 'Status invalido. Use: ' + validStatuses.join(', ') });
  }

  const normalizedInterviewDate =
    status === 'interview' ? normalizeDateValue(interviewDate) : null;
  if (status === 'interview' && !normalizedInterviewDate) {
    return res
      .status(400)
      .json({ error: 'Informe uma data valida para a entrevista.' });
  }

  try {
    const decodedToken = await adminApp.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Empresas gerem as suas candidaturas; administradores gerem apenas as
    // candidaturas de vagas que foram publicadas pelo Admin.
    const userDoc = await adminApp
      .firestore()
      .collection('users')
      .doc(uid)
      .get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const userData = userDoc.data();
    const isCompanyActor = userData.userType === 'empresa';
    const isAdminActor = userData.userType === 'admin';
    if (!isCompanyActor && !isAdminActor) {
      return res
        .status(403)
        .json({ error: 'Sem permissao para atualizar status de candidaturas' });
    }

    if (status === 'interview' && isCompanyActor) {
      const planSummary = getEmpresaPlanSummary(userData);
      const interviewAccess = canScheduleInterview(planSummary.planId);
      if (!interviewAccess.allowed) {
        return res.status(403).json({
          error: interviewAccess.reason,
          code: interviewAccess.code,
          upgradeMessage: interviewAccess.upgradeMessage,
          upgradeUrl: interviewAccess.upgradeUrl,
        });
      }
    }

    // Get application
    const applicationRef = adminApp
      .firestore()
      .collection('applications')
      .doc(id);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ error: 'Candidatura nao encontrada' });
    }

    const applicationData = applicationDoc.data();

    // A vaga é também a fonte de verdade para autorizar ações administrativas.
    let jobData = {};

    if (applicationData.jobId) {
      const jobDoc = await adminApp
        .firestore()
        .collection('jobs')
        .doc(applicationData.jobId)
        .get();
      if (jobDoc.exists) {
        jobData = jobDoc.data() || {};
      }
    }

    const applicationCompanyId = resolveApplicationCompanyId(
      applicationData,
      jobData,
    );

    const canManageAsCompany =
      isCompanyActor &&
      Boolean(applicationCompanyId) &&
      applicationCompanyId === uid;
    const canManageAsAdmin = isAdminActor && isAdminPublishedJob(jobData, uid);

    if (!canManageAsCompany && !canManageAsAdmin) {
      return res.status(403).json({
        error: 'Voce nao tem permissao para atualizar esta candidatura',
      });
    }

    const previousStatus = applicationData.status;

    const interviewDetails =
      status === 'interview'
        ? {
            scheduledAt: normalizedInterviewDate.toISOString(),
            mode: interviewMode || 'online',
            location: interviewLocation || '',
            link: interviewLink || '',
            notes: interviewNotes || '',
            status: 'scheduled',
          }
        : null;

    if (status === 'interview') {
      if (interviewDetails.mode === 'online' && !interviewDetails.link) {
        return res
          .status(400)
          .json({ error: 'Informe o link da entrevista online.' });
      }

      if (
        interviewDetails.mode === 'presencial' &&
        !interviewDetails.location
      ) {
        return res
          .status(400)
          .json({ error: 'Informe o local da entrevista presencial.' });
      }
    }

    const updateData = {
      status,
      statusUpdatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      statusUpdatedBy: uid,
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
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      };
    }
    // Append timeline event atomically (avoid lost updates).
    const companyName = isAdminActor
      ? jobData.companyName ||
        jobData.empresaNome ||
        jobData.empresa ||
        'Empresa'
      : userData.name || userData.fullName || userData.companyName || 'Empresa';
    const timelineEvent = buildTimelineEvent({
      status,
      notes,
      interviewDetails,
      companyName,
      actorType: isAdminActor ? 'admin' : 'empresa',
    });

    // Referências v2 alocadas uma vez (fora das novas tentativas da transação).
    const lifecycleRefs = { history: [], event: null, hire: null };
    const allocateLifecycleRefs = (count) => {
      const db = adminApp.firestore();
      while (lifecycleRefs.history.length < count)
        lifecycleRefs.history.push(
          db.collection('applicationsStatusHistory').doc(),
        );
      lifecycleRefs.event ||= db.collection('outboxEvents').doc();
      return lifecycleRefs;
    };

    try {
      await adminApp.firestore().runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(applicationRef);
        if (!freshDoc.exists) {
          throw new Error('Candidatura nao encontrada');
        }
        const freshData = freshDoc.data() || {};
        if (String(freshData.status || '').toLowerCase() === 'withdrawn') {
          throw applicationStatusError(
            'APPLICATION_WITHDRAWN',
            'Esta candidatura foi retirada pelo candidato e já não pode ser atualizada.',
          );
        }
        const currentTimeline = Array.isArray(freshData.timeline)
          ? freshData.timeline
          : [];
        const nextTimeline = [...currentTimeline, timelineEvent].slice(-40);
        // D7: candidatura v2 — a mesma decisão expressa como transições E4,
        // com histórico por passo, para o candidato ver o que a empresa fez.
        let lifecycleUpdate = {};
        if (typeof freshData.v2Status === 'string') {
          const plan = planLegacyAtsTransition(freshData.v2Status, status);
          if (!plan.ok) {
            throw applicationStatusError(
              plan.code,
              'Esta mudança de estado não é permitida para esta candidatura.',
            );
          }
          if (plan.steps.length) {
            const refs = allocateLifecycleRefs(plan.steps.length);
            let from = freshData.v2Status;
            let version = Number.isSafeInteger(freshData.version)
              ? freshData.version
              : 0;
            const at = firebaseAdmin.firestore.Timestamp.now();
            plan.steps.forEach((to, index) => {
              version += 1;
              transaction.create(refs.history[index], {
                entityId: id,
                from,
                to,
                actorId: uid,
                actorType: isAdminActor ? 'ADMIN' : 'EMPLOYER',
                reason:
                  from === 'INTERVIEW' && to === 'UNDER_REVIEW'
                    ? LEGACY_ATS_REASON
                    : null,
                closedReason: to === 'REJECTED' ? plan.closedReason : null,
                at,
                version,
              });
              from = to;
            });
            transaction.create(refs.event, {
              type: 'entity_status_changed',
              schemaVersion: 1,
              payload: { entityId: id, entityKind: 'Application', version },
              status: 'PENDING',
              attempts: 0,
              createdAtMs: Date.now(),
              nextAttemptAtMs: Date.now(),
            });
            if (plan.createsHire) {
              // E5.5: contratação marcada diretamente; o candidato confirma aos 30 dias.
              refs.hire ||= adminApp.firestore().collection('hires').doc(id);
              transaction.set(refs.hire, {
                applicationId: id,
                jobId: freshData.jobId || null,
                organizationId:
                  freshData.organizationId || freshData.companyId || null,
                candidateUserId:
                  freshData.candidateUserId || freshData.candidateId || null,
                startDate: null,
                confirmedByEmployerAt: at,
                candidateConfirmation: 'PENDING',
                attributionSource: freshData.source || 'direct',
                source: 'DIRECT_MARK',
                status: 'ACTIVE',
                v2Status: 'ACTIVE',
                version: 1,
                createdAt: at,
                createdBy: uid,
              });
            }
            lifecycleUpdate = {
              v2Status: from,
              version,
              lastStatusChangeAt: at,
              updatedBy: uid,
              ...(plan.closedReason ? { closedReason: plan.closedReason } : {}),
              ...(freshData.v2Status === 'SUBMITTED' && !freshData.firstViewedAt
                ? { firstViewedAt: at }
                : {}),
            };
          }
        }
        transaction.update(applicationRef, {
          ...updateData,
          ...lifecycleUpdate,
          timeline: nextTimeline,
        });
      });
    } catch (transactionError) {
      if (
        transactionError?.code === 'APPLICATION_WITHDRAWN' ||
        transactionError?.code === 'TRANSITION_NOT_ALLOWED'
      ) {
        return res.status(409).json({
          code: transactionError.code,
          error: transactionError.message,
        });
      }
      throw transactionError;
    }

    // Create notification for candidate
    if (applicationData.candidateId) {
      const interviewDateLabel = interviewDetails?.scheduledAt
        ? new Date(interviewDetails.scheduledAt).toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null;

      const interviewContext =
        interviewDetails?.mode === 'presencial'
          ? `Local: ${interviewDetails.location}.`
          : interviewDetails?.mode === 'online'
            ? 'Verifique o link enviado pela empresa.'
            : '';

      const notificationMessages = {
        analysis: `A sua candidatura para ${applicationData.jobTitle || 'a vaga'} está em análise pela empresa.`,
        interview: interviewDateLabel
          ? `A sua entrevista para ${applicationData.jobTitle || 'a vaga'} está marcada para ${interviewDateLabel}. ${interviewContext}`.trim()
          : `Parabéns! Foi selecionado(a) para entrevista para ${applicationData.jobTitle || 'a vaga'}. A empresa vai entrar em contacto consigo.`,
        approved: `Parabéns! A sua candidatura para ${applicationData.jobTitle || 'a vaga'} foi aprovada.`,
        // F3.6/B7: respeitosa, sem culpabilizar e com um próximo passo útil.
        rejected: `Obrigado pelo interesse ${applicationData.jobTitle ? `na vaga de ${applicationData.jobTitle}` : 'nesta vaga'}. Desta vez, a empresa decidiu avançar com outros perfis. Continue a acompanhar novas oportunidades no EmpregoSTP.`,
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
            actionUrl: '/dashboard/candidato?tab=applications',
          });
        } catch (notifError) {
          logServerError(
            'applications_id_status.criar_notificacao_failed',
            notifError,
          );
        }
      }
    }

    // Log activity
    await recordActivity(adminApp, {
      type: 'application_status_changed',
      description: `Candidatura à vaga "${applicationData.jobTitle || applicationData.jobId}" passou de ${previousStatus} para ${status}`,
      actorId: uid,
      actorType: isAdminActor ? 'admin' : 'empresa',
      companyId: applicationCompanyId || null,
      applicationId: id,
      candidateId: applicationData.candidateId,
      jobId: applicationData.jobId,
      previousStatus,
      newStatus: status,
      notes: notes || null,
      interviewDetails: interviewDetails || null,
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
              updatedAt: new Date().toISOString(),
            }
          : applicationData.interviewDetails
            ? {
                ...applicationData.interviewDetails,
                scheduledAt: serializeTimestamp(
                  applicationData.interviewDetails.scheduledAt,
                ),
                updatedAt: serializeTimestamp(
                  applicationData.interviewDetails.updatedAt,
                ),
              }
            : null,
      },
    });
  } catch (error) {
    logServerError(
      'applications_id_status.atualizar_status_da_candidatura_failed',
      error,
    );
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
