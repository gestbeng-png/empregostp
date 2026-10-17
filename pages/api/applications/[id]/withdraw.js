import { admin as adminApp } from '../../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../../lib/serverNotifications';
import { logServerError } from '../../../../lib/serverLog';
import { requireActiveApiUser } from '../../../../lib/apiUserAuth';
import { recordActivity } from '../../../../lib/activityLog';
import { assertTransition } from '../../../../domain/applications/states';
import { legacyStatusUpdate } from '../../../../domain/lifecycle/legacyStatus';

// F2.6 — motivos opcionais (nunca texto livre identificável).
export const WITHDRAWAL_REASONS = new Set([
  'ACCEPTED_OTHER_OFFER',
  'NOT_INTERESTED',
  'OTHER',
]);

export const WITHDRAWABLE_APPLICATION_STATUSES = new Set([
  'pending',
  'analysis',
]);

function withdrawalError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const applicationId = String(req.query?.id || '').trim();
  if (!applicationId) {
    return res.status(400).json({ error: 'Candidatura inválida' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      adminApp,
      missingTokenMessage: 'Não autorizado',
    });
    if (!authResult) return;
    const { uid, userData } = authResult;

    if (userData.userType !== 'candidato') {
      return res.status(403).json({
        error: 'Apenas candidatos podem retirar candidaturas.',
      });
    }

    const applicationRef = adminApp
      .firestore()
      .collection('applications')
      .doc(applicationId);
    let applicationData = null;
    let timelineEvent = null;
    let alreadyWithdrawn = false;
    const reason = WITHDRAWAL_REASONS.has(req.body?.reason)
      ? req.body.reason
      : null;
    // Só para candidaturas v2; alocados uma vez, não em cada nova tentativa.
    let historyRef = null;
    let eventRef = null;

    try {
      await adminApp.firestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(applicationRef);
        if (!snapshot.exists) {
          throw withdrawalError(
            'APPLICATION_NOT_FOUND',
            'Candidatura não encontrada.',
          );
        }

        const data = snapshot.data() || {};
        if (data.candidateId !== uid) {
          throw withdrawalError(
            'APPLICATION_FORBIDDEN',
            'Não pode retirar esta candidatura.',
          );
        }

        const status = String(data.status || 'pending').toLowerCase();
        // Candidaturas v2: a máquina de estados decide (qualquer estado não
        // terminal) e o estado legado é escrito em conjunto (D7).
        if (typeof data.v2Status === 'string') {
          if (data.v2Status === 'WITHDRAWN') {
            applicationData = data;
            alreadyWithdrawn = true;
            return;
          }
          const allowed = assertTransition(
            data.v2Status,
            'WITHDRAWN',
            'CANDIDATE',
          );
          if (!allowed.ok) {
            throw withdrawalError(
              'APPLICATION_STATUS_NOT_WITHDRAWABLE',
              'Esta candidatura já está encerrada e não pode ser retirada.',
            );
          }
          historyRef ||= adminApp
            .firestore()
            .collection('applicationsStatusHistory')
            .doc();
          eventRef ||= adminApp.firestore().collection('outboxEvents').doc();
          const legacy = legacyStatusUpdate('Application', 'WITHDRAWN');
          const version =
            (Number.isSafeInteger(data.version) ? data.version : 0) + 1;
          const nowMs = Date.now();
          timelineEvent = {
            title: 'Candidatura retirada',
            description: 'Retirou voluntariamente a candidatura.',
            icon: '↩️',
            date: new Date(nowMs).toISOString(),
            by: uid,
            byType: 'candidato',
          };
          applicationData = data;
          transaction.update(applicationRef, {
            ...(legacy.ok ? legacy.value : { status: 'withdrawn' }),
            v2Status: 'WITHDRAWN',
            version,
            withdrawalReason: reason,
            withdrawnAt: adminApp.firestore.FieldValue.serverTimestamp(),
            lastStatusChangeAt: adminApp.firestore.FieldValue.serverTimestamp(),
            updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
            timeline: [
              ...(Array.isArray(data.timeline) ? data.timeline : []),
              timelineEvent,
            ],
          });
          transaction.create(historyRef, {
            entityId: applicationId,
            from: data.v2Status,
            to: 'WITHDRAWN',
            actorId: uid,
            actorType: 'CANDIDATE',
            reason,
            at: adminApp.firestore.FieldValue.serverTimestamp(),
            version,
          });
          transaction.create(eventRef, {
            type: 'entity_status_changed',
            schemaVersion: 1,
            payload: {
              entityId: applicationId,
              entityKind: 'Application',
              version,
            },
            status: 'PENDING',
            attempts: 0,
            createdAtMs: nowMs,
            nextAttemptAtMs: nowMs,
          });
          return;
        }
        if (status === 'withdrawn') {
          applicationData = data;
          alreadyWithdrawn = true;
          return;
        }
        if (!WITHDRAWABLE_APPLICATION_STATUSES.has(status)) {
          throw withdrawalError(
            'APPLICATION_STATUS_NOT_WITHDRAWABLE',
            'Esta candidatura já avançou e não pode ser retirada online.',
          );
        }

        timelineEvent = {
          title: 'Candidatura retirada',
          description: 'Retirou voluntariamente a candidatura.',
          icon: '↩️',
          date: new Date().toISOString(),
          by: uid,
          byType: 'candidato',
        };
        applicationData = data;
        transaction.update(applicationRef, {
          status: 'withdrawn',
          withdrawnAt: adminApp.firestore.FieldValue.serverTimestamp(),
          updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
          timeline: [
            ...(Array.isArray(data.timeline) ? data.timeline : []),
            timelineEvent,
          ],
        });
      });
    } catch (error) {
      if (error?.code === 'APPLICATION_NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error?.code === 'APPLICATION_FORBIDDEN') {
        return res.status(403).json({ error: error.message });
      }
      if (error?.code === 'APPLICATION_STATUS_NOT_WITHDRAWABLE') {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }

    if (alreadyWithdrawn) {
      return res.status(200).json({
        message: 'Esta candidatura já se encontra retirada.',
        status: 'withdrawn',
        alreadyWithdrawn: true,
      });
    }

    try {
      await recordActivity(adminApp, {
        type: 'application_withdrawn',
        description: `Candidatura retirada pelo candidato à vaga "${applicationData?.jobTitle || applicationData?.jobId || ''}"`,
        applicationId,
        candidateId: uid,
        jobId: applicationData?.jobId || null,
      });

      if (applicationData?.companyId) {
        await createServerNotification(adminApp, {
          userId: applicationData.companyId,
          title: 'Candidatura retirada',
          message: `${applicationData.candidateName || 'Um candidato'} retirou a candidatura para ${applicationData.jobTitle || 'a vaga'}.`,
          type: 'application',
          icon: '↩️',
          relatedId: applicationId,
          relatedJobId: applicationData.jobId || null,
          actionUrl: '/dashboard/empresa?tab=applications',
        });
      }
    } catch (notificationError) {
      logServerError(
        'applications.registar_retirada_notificar_empresa_failed',
        notificationError,
      );
    }

    return res.status(200).json({
      message: 'Candidatura retirada com sucesso.',
      status: 'withdrawn',
      alreadyWithdrawn: false,
      timelineEvent,
    });
  } catch (error) {
    logServerError('applications.retirar_candidatura_failed', error);
    return res.status(500).json({
      error: 'Não foi possível retirar a candidatura. Tente novamente.',
    });
  }
}
