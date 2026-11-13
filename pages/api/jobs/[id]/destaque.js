import { admin } from '../../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../../lib/apiUserAuth';
import {
  canHighlightJob,
  getEmpresaPlanSummary,
} from '../../../../lib/empresaPlanFeatures';
import {
  getEffectiveJobStatus,
  syncExpiredJobStatus,
} from '../../../../lib/jobExpiration';
import { logServerError } from '../../../../lib/serverLog';

/**
 * PATCH /api/jobs/[id]/destaque
 * Toggle destaque status for a job listing
 */
export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const auth = await requireActiveApiUser(req, res, { adminApp: admin });
    if (!auth) return;
    const { uid: userId, userData } = auth;
    if (userData.userType !== 'empresa') {
      return res.status(403).json({ error: 'Only companies can update jobs' });
    }

    // Get job
    const jobRef = admin.firestore().collection('jobs').doc(id);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const synced = await syncExpiredJobStatus(jobRef, jobDoc.data(), admin);
    const job = synced.jobData;

    // Verify ownership
    if (job.companyId !== userId) {
      return res
        .status(403)
        .json({ error: 'Unauthorized - Job belongs to another company' });
    }

    const highlightRequested = req.body?.destaque === true;
    if (highlightRequested && getEffectiveJobStatus(job) !== 'active') {
      return res
        .status(400)
        .json({ error: 'Apenas vagas ativas podem ficar em destaque' });
    }

    const planSummary = getEmpresaPlanSummary(userData);
    if (highlightRequested && !job.destaque) {
      const highlightCheck = await canHighlightJob(
        userId,
        planSummary.planId,
        admin,
      );
      if (!highlightCheck.allowed) {
        return res.status(403).json(highlightCheck);
      }
    }

    // Update job destaque status
    await jobRef.update({
      destaque: highlightRequested,
      destaqueActivatedAt: highlightRequested
        ? admin.firestore.FieldValue.serverTimestamp()
        : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const highlightedSnapshot = await admin
      .firestore()
      .collection('jobs')
      .where('companyId', '==', userId)
      .where('status', '==', 'active')
      .where('destaque', '==', true)
      .get();

    // Create audit log
    await admin.firestore().collection('audit_logs').add({
      action: 'JOB_DESTAQUE_TOGGLED',
      userId: userId,
      jobId: id,
      destaque: req.body.destaque,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: `Vaga ${highlightRequested ? 'destacada' : 'removida do destaque'} com sucesso`,
      destaque: highlightRequested,
      destaques: {
        current: highlightedSnapshot.size,
        max: planSummary.features.maxHighlightedJobs ?? null,
      },
    });
  } catch (error) {
    logServerError('jobs_id_destaque.updating_job_destaque_failed', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
