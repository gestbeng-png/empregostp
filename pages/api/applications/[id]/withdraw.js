import { admin as adminApp } from '../../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../../lib/serverNotifications';
import { logServerError } from '../../../../lib/serverLog';
import { requireActiveApiUser } from '../../../../lib/apiUserAuth';
import { recordActivity } from '../../../../lib/activityLog';

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
