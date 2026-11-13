import { admin } from '../../../lib/firebaseAdmin';
import {
  buildVerificationStateUpdate,
  getVerificationApprovalEligibility,
  reviewVerificationRecord,
  serializeVerificationTimestamps,
  VERIFICATION_TYPE_CONFIG,
} from '../../../lib/candidateVerification';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { createServerNotification } from '../../../lib/serverNotifications';
import { logServerError } from '../../../lib/serverLog';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const {
      verificationId,
      uid,
      action,
      reason = '',
      verificationType = null,
    } = req.body || {};

    if (!verificationId || !uid || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['approve', 'reject', 'revoke', 'reactivate'].includes(action)) {
      return res.status(400).json({
        error:
          'Invalid action. Must be "approve", "reject", "revoke" or "reactivate"',
      });
    }

    const authResult = await requireActiveApiUser(req, res);
    if (!authResult) return;
    const adminUid = authResult.uid;
    if (authResult.userData.userType !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Forbidden - Admin access required' });
    }

    const verificationRef = admin
      .firestore()
      .collection('verifications')
      .doc(verificationId);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return res.status(404).json({ error: 'Verification request not found' });
    }

    const verificationData = serializeVerificationTimestamps(
      verificationDoc.data() || {},
    );

    // O `uid` vem do cliente, mas a elegibilidade é avaliada sobre o dono do
    // pedido. Sem esta igualdade era possível aprovar a verificação de A — que
    // tem CV e plano — e escrever `verified: true` em B, que nunca submeteu
    // nem pagou, porque a sincronização, o log e a notificação usavam o `uid`
    // recebido em vez do que consta no pedido.
    if (String(uid) !== String(verificationData.uid || '')) {
      return res.status(400).json({
        error:
          'O utilizador indicado não corresponde ao do pedido de verificação.',
        code: 'VERIFICATION_UID_MISMATCH',
      });
    }

    const targetItem = verificationType
      ? verificationData.verificationItems?.[verificationType]
      : null;
    if (verificationType && !targetItem) {
      return res
        .status(404)
        .json({ error: 'Verification type not found in this request' });
    }
    if (action === 'revoke') {
      // Só se revoga o que está aprovado; sem tipo, revoga todos os aprovados.
      const hasApprovedItem = verificationType
        ? targetItem.status === 'approved'
        : Object.values(verificationData.verificationItems || {}).some(
            (item) => item?.status === 'approved',
          );
      if (!hasApprovedItem) {
        return res.status(400).json({
          error: 'Não há nenhuma verificação aprovada para desativar.',
        });
      }
    } else if (action === 'reactivate') {
      const hasRevokedItem = verificationType
        ? targetItem.status === 'rejected' && Boolean(targetItem.revokedAt)
        : Object.values(verificationData.verificationItems || {}).some(
            (item) => item?.status === 'rejected' && item?.revokedAt,
          );
      if (!hasRevokedItem) {
        return res.status(400).json({
          error: 'Não há nenhuma verificação desativada para reativar.',
        });
      }
    } else {
      if (verificationType && targetItem.status !== 'pending') {
        return res
          .status(400)
          .json({ error: 'Verification type already reviewed' });
      }
      if (
        !verificationType &&
        !Object.values(verificationData.verificationItems || {}).some(
          (item) => item?.status === 'pending',
        )
      ) {
        return res.status(400).json({ error: 'Verification already reviewed' });
      }
    }

    if (action === 'approve' || action === 'reactivate') {
      const [userDoc, profileDoc] = await Promise.all([
        admin.firestore().collection('users').doc(verificationData.uid).get(),
        admin
          .firestore()
          .collection('profiles')
          .doc(verificationData.uid)
          .get(),
      ]);
      const eligibility = getVerificationApprovalEligibility(
        userDoc.data() || {},
        profileDoc.data() || {},
        verificationData,
      );
      if (!eligibility.allowed) {
        return res
          .status(400)
          .json({ error: eligibility.reason, code: eligibility.code });
      }
    }

    const reviewedRecord = reviewVerificationRecord(verificationData, {
      action,
      verificationType,
      reviewerId: adminUid,
      reason,
      now: new Date().toISOString(),
    });

    const batch = admin.firestore().batch();
    batch.set(
      verificationRef,
      {
        status: reviewedRecord.status,
        verificationItems: reviewedRecord.verificationItems,
        summary: reviewedRecord.summary,
        reviewReason: reason || null,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: adminUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const stateUpdate = buildVerificationStateUpdate(
      verificationId,
      reviewedRecord,
      admin.firestore.FieldValue.serverTimestamp(),
    );
    // Uma desativação explícita do perfil pelo admin prevalece também sobre
    // o selo automático do Premium. Rejeitar documentos não cancela o plano.
    if (!verificationType && action === 'revoke') {
      stateUpdate.verificationDisabled = true;
    } else if (stateUpdate.verified && ['approve', 'reactivate'].includes(action)) {
      stateUpdate.verificationDisabled = false;
    }
    for (const collection of ['users', 'profiles']) {
      batch.set(
        admin.firestore().collection(collection).doc(uid),
        stateUpdate,
        { merge: true },
      );
    }

    const actionVerb = {
      approve: 'aprovada',
      reject: 'rejeitada',
      revoke: 'desativada',
      reactivate: 'reativada',
    }[action];
    const actionSuffix = {
      approve: 'approved',
      reject: 'rejected',
      revoke: 'revoked',
      reactivate: 'reactivated',
    }[action];

    batch.set(admin.firestore().collection('activities').doc(), {
      type: verificationType
        ? `verification_item_${actionSuffix}`
        : `verification_${actionSuffix}`,
      description: verificationType
        ? `${VERIFICATION_TYPE_CONFIG[verificationType]?.label || verificationType} do utilizador ${uid} foi ${actionVerb}`
        : `Verificação do utilizador ${uid} foi ${actionVerb} por um administrador`,
      userId: uid,
      verificationId,
      verificationType,
      adminId: adminUid,
      createdAt: new Date().toISOString(),
    });

    await batch.commit();
    const savedRecord = serializeVerificationTimestamps(
      (await verificationRef.get()).data() || {},
    );

    try {
      const targetLabel = verificationType
        ? VERIFICATION_TYPE_CONFIG[verificationType]?.label || verificationType
        : 'verificação de perfil';
      await createServerNotification(admin, {
        userId: uid,
        type:
          action === 'approve' || action === 'reactivate'
            ? 'verification_approved'
            : 'verification_rejected',
        title:
          action === 'approve' || action === 'reactivate'
            ? '✅ Verificação atualizada'
            : '❌ Verificação atualizada',
        message:
          action === 'reactivate'
            ? `${targetLabel} foi reativada e o selo voltou a ficar disponível.`
            : action === 'approve'
              ? `${targetLabel} foi aprovada. Consulte o painel de verificação para ver o progresso atual.`
              : action === 'revoke'
                ? `${targetLabel} foi desativada por um administrador. ${reason || 'Pode voltar a submeter no painel de verificação.'}`
                : `${targetLabel} foi rejeitada. ${reason || 'Consulte o painel de verificação para rever o motivo.'}`,
        actionUrl: '/dashboard/candidato?tab=verification',
      });
    } catch (notifError) {
      logServerError(
        'admin_verify_action.creating_notification_failed',
        notifError,
      );
    }

    return res.status(200).json({
      success: true,
      message: `Verification ${actionSuffix} successfully`,
      newStatus: reviewedRecord.status,
      verification: savedRecord,
    });
  } catch (error) {
    logServerError(
      'admin_verify_action.processing_verification_action_failed',
      error,
    );
    return res
      .status(500)
      .json({ error: 'Internal server error', details: error.message });
  }
}
