import { admin } from '../../../lib/firebaseAdmin';
import {
  buildVerificationProfileSummary,
  derivePublicVerificationState,
  reviewVerificationRecord,
  serializeVerificationTimestamps,
  VERIFICATION_TYPE_CONFIG,
} from '../../../lib/candidateVerification';
import { canVerifyProfile } from '../../../lib/candidatePlanFeatures';
import { createServerNotification } from '../../../lib/serverNotifications';
import { logServerError } from '../../../lib/serverLog';

async function syncVerificationState(uid, verificationId, record) {
  const publicState = derivePublicVerificationState(record);
  const summary = buildVerificationProfileSummary(record);
  const nowIso = new Date().toISOString();

  const baseUpdate = {
    verificationId,
    verificationStatus: publicState.verificationStatus,
    verified: publicState.verified,
    rejectionReason: publicState.rejectionReason || '',
    verificationSummary: {
      ...summary,
      lastSyncedAt: nowIso,
    },
    verificationItems: summary.types || {},
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await Promise.all([
    admin.firestore().collection('users').doc(uid).set(
      {
        ...baseUpdate,
        verificationReviewedAt:
          summary.pendingCount === 0 && summary.requestedCount > 0 ? nowIso : null,
        ...(publicState.verified ? { verifiedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
      },
      { merge: true }
    ),
    admin.firestore().collection('profiles').doc(uid).set(
      {
        verificationStatus: publicState.verificationStatus,
        verified: publicState.verified,
        rejectionReason: publicState.rejectionReason || '',
        verificationSummary: {
          ...summary,
          lastSyncedAt: nowIso,
        },
        verificationItems: summary.types || {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { verificationId, uid, action, reason = '', verificationType = null } = req.body || {};

    if (!verificationId || !uid || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminUid = decodedToken.uid;

    const adminDoc = await admin.firestore().collection('users').doc(adminUid).get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const verificationRef = admin.firestore().collection('verifications').doc(verificationId);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return res.status(404).json({ error: 'Verification request not found' });
    }

    const verificationData = serializeVerificationTimestamps(verificationDoc.data() || {});

    // O `uid` vem do cliente, mas a elegibilidade é avaliada sobre o dono do
    // pedido. Sem esta igualdade era possível aprovar a verificação de A — que
    // tem CV e plano — e escrever `verified: true` em B, que nunca submeteu
    // nem pagou, porque a sincronização, o log e a notificação usavam o `uid`
    // recebido em vez do que consta no pedido.
    if (String(uid) !== String(verificationData.uid || '')) {
      return res.status(400).json({
        error: 'O utilizador indicado não corresponde ao do pedido de verificação.',
        code: 'VERIFICATION_UID_MISMATCH',
      });
    }

    const targetItem = verificationType ? verificationData.verificationItems?.[verificationType] : null;
    if (verificationType && !targetItem) {
      return res.status(404).json({ error: 'Verification type not found in this request' });
    }
    if (verificationType && targetItem.status !== 'pending') {
      return res.status(400).json({ error: 'Verification type already reviewed' });
    }
    if (!verificationType && verificationData.status !== 'pending') {
      return res.status(400).json({ error: 'Verification already reviewed' });
    }

    if (action === 'approve') {
      const targetUserDoc = await admin.firestore().collection('users').doc(verificationData.uid).get();
      const targetUserData = targetUserDoc.exists ? targetUserDoc.data() || {} : {};

      // O CV visível ao candidato (perfil) é o que realmente importa aqui — pode
      // não ter sido re-anexado neste pedido específico se só outro tipo (ex.
      // certificados) foi submetido desta vez.
      const hasCv = Boolean(String(targetUserData.cvUrl || '').trim());
      if (!hasCv) {
        return res.status(400).json({
          error: 'Não é possível aprovar: o candidato ainda não anexou um currículo (CV) ao perfil.',
          code: 'VERIFICATION_MISSING_CV',
        });
      }

      // O plano pode ter mudado ou expirado entre a submissão e esta revisão —
      // reconfirmar o pagamento agora em vez de confiar na checagem feita na altura do envio.
      const paymentAccess = canVerifyProfile(targetUserData.currentPlan);
      if (!paymentAccess.allowed) {
        return res.status(400).json({
          error: 'Não é possível aprovar: o plano atual do candidato já não inclui verificação de perfil (pagamento não confirmado).',
          code: 'VERIFICATION_PLAN_NOT_ELIGIBLE',
        });
      }
    }

    const reviewedRecord = reviewVerificationRecord(verificationData, {
      action,
      verificationType,
      reviewerId: adminUid,
      reason,
      now: new Date().toISOString(),
    });

    await verificationRef.set(
      {
        status: reviewedRecord.status,
        verificationItems: reviewedRecord.verificationItems,
        summary: reviewedRecord.summary,
        reviewReason: reason || null,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: adminUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const savedDoc = await verificationRef.get();
    const savedRecord = serializeVerificationTimestamps(savedDoc.data() || {});
    await syncVerificationState(uid, verificationId, savedRecord);

    await admin.firestore().collection('activities').add({
      type:
        action === 'approve'
          ? verificationType
            ? 'verification_item_approved'
            : 'verification_approved'
          : verificationType
            ? 'verification_item_rejected'
            : 'verification_rejected',
      description: verificationType
        ? `${VERIFICATION_TYPE_CONFIG[verificationType]?.label || verificationType} do utilizador ${uid} foi ${action === 'approve' ? 'aprovada' : 'rejeitada'}`
        : `Verificação do utilizador ${uid} foi ${action === 'approve' ? 'aprovada' : 'rejeitada'} por um administrador`,
      userId: uid,
      verificationId,
      verificationType,
      adminId: adminUid,
      createdAt: new Date().toISOString(),
    });

    try {
      const targetLabel = verificationType ? VERIFICATION_TYPE_CONFIG[verificationType]?.label || verificationType : 'verificação de perfil';
      await createServerNotification(admin, {
        userId: uid,
        type: action === 'approve' ? 'verification_approved' : 'verification_rejected',
        title: action === 'approve' ? '✅ Verificação atualizada' : '❌ Verificação atualizada',
        message: action === 'approve'
          ? `${targetLabel} foi aprovada. Consulte o painel de verificação para ver o progresso atual.`
          : `${targetLabel} foi rejeitada. ${reason || 'Consulte o painel de verificação para rever o motivo.'}`,
        actionUrl: '/dashboard/candidato?tab=verification',
      });
    } catch (notifError) {
      logServerError('admin_verify_action.creating_notification_failed', notifError);
    }

    return res.status(200).json({
      success: true,
      message: `Verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      newStatus: reviewedRecord.status,
      verification: savedRecord,
    });
  } catch (error) {
    logServerError('admin_verify_action.processing_verification_action_failed', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
