import { admin } from '../../../lib/firebaseAdmin';
import {
  buildVerificationProfileSummary,
  derivePublicVerificationState,
  reviewVerificationRecord,
  serializeVerificationTimestamps,
  VERIFICATION_TYPE_CONFIG,
} from '../../../lib/candidateVerification';
import { createServerNotification } from '../../../lib/serverNotifications';

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
    return res.status(405).json({ error: 'Method not allowed' });
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
      console.error('Error creating notification:', notifError);
    }

    return res.status(200).json({
      success: true,
      message: `Verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      newStatus: reviewedRecord.status,
      verification: savedRecord,
    });
  } catch (error) {
    console.error('Error processing verification action:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
