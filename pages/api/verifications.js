import { admin } from '../../lib/firebaseAdmin';
import { canVerifyProfile, getPlanSummary } from '../../lib/candidatePlanFeatures';
import {
  buildVerificationProfileSummary,
  buildVerificationRecord,
  derivePublicVerificationState,
  reviewVerificationRecord,
  serializeVerificationTimestamps,
  validateVerificationRecord,
} from '../../lib/candidateVerification';
import { logServerError } from '../../lib/serverLog';
import { requireActiveApiUser } from '../../lib/apiUserAuth';

async function isAdminUser(uid) {
  if (!uid) return false;
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.userType === 'admin';
}

async function getLatestVerificationByUid(uid) {
  const snapshot = await admin.firestore().collection('verifications').where('uid', '==', uid).get();
  const docs = snapshot.docs.sort((a, b) => {
    const timeA =
      a.data().updatedAt?.toDate?.()?.getTime?.() ||
      a.data().submittedAt?.toDate?.()?.getTime?.() ||
      a.data().createdAt?.toDate?.()?.getTime?.() ||
      0;
    const timeB =
      b.data().updatedAt?.toDate?.()?.getTime?.() ||
      b.data().submittedAt?.toDate?.()?.getTime?.() ||
      b.data().createdAt?.toDate?.()?.getTime?.() ||
      0;
    return timeB - timeA;
  });

  return docs[0] || null;
}

function buildVerificationResponse(doc) {
  if (!doc?.exists) return null;
  const data = serializeVerificationTimestamps(doc.data() || {});
  return {
    id: doc.id,
    ...data,
  };
}

async function syncVerificationState(uid, verificationId, record) {
  const publicState = derivePublicVerificationState(record);
  const summary = buildVerificationProfileSummary(record);
  const nowIso = new Date().toISOString();

  const sharedFields = {
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

  const userUpdate = {
    ...sharedFields,
    verificationReviewedAt:
      summary.pendingCount === 0 && summary.requestedCount > 0 ? nowIso : null,
  };

  if (publicState.verified) {
    userUpdate.verifiedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await Promise.all([
    admin.firestore().collection('users').doc(uid).set(userUpdate, { merge: true }),
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
  try {
    const authResult = await requireActiveApiUser(req, res, {
      missingTokenMessage: 'Token não fornecido',
    });
    if (!authResult) return;
    const { decodedToken } = authResult;

    if (req.method === 'POST') {
      return handlePost(req, res, decodedToken);
    }
    if (req.method === 'GET') {
      return handleGet(req, res, decodedToken);
    }
    if (req.method === 'PUT') {
      return handlePut(req, res, decodedToken);
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    logServerError('verifications.api_de_verificacoes_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
}

async function handlePost(req, res, decodedToken) {
  try {
    const { uid, documents = {}, companyName = '' } = req.body || {};
    const safeCompanyName = typeof companyName === 'string' ? companyName.trim() : '';

    if (!uid) {
      return res.status(400).json({ error: 'UID não fornecido' });
    }

    const requesterIsAdmin = await isAdminUser(decodedToken.uid);
    if (decodedToken.uid !== uid && !requesterIsAdmin) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const [targetUserDoc, targetProfileDoc, latestVerificationDoc] = await Promise.all([
      admin.firestore().collection('users').doc(uid).get(),
      admin.firestore().collection('profiles').doc(uid).get(),
      getLatestVerificationByUid(uid),
    ]);

    if (!targetUserDoc.exists) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const targetUserData = targetUserDoc.data() || {};
    const targetProfileData = targetProfileDoc.exists ? targetProfileDoc.data() : {};

    if (targetUserData.userType !== 'candidato') {
      return res.status(403).json({ error: 'A verificação de perfil está disponível apenas para candidatos' });
    }

    const targetUserRef = targetUserDoc.ref;
    const planSummary = getPlanSummary(targetUserData);

    if (targetUserData.currentPlan && targetUserData.currentPlan !== planSummary.planId) {
      try {
        if (!planSummary.isActive) {
          await targetUserRef.update({
            currentPlan: 'basic_candidato',
            planId: 'basic_candidato',
            planName: 'Básico',
            planEndDate: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await targetUserRef.update({
            currentPlan: planSummary.planId,
            planId: planSummary.planId,
            planName: planSummary.planName || targetUserData.planName || '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (planSyncError) {
        logServerError('verifications.sincronizar_plano_para_verificacao_failed', planSyncError);
      }
    }

    const verifyAccess = canVerifyProfile(planSummary.planId);
    if (!verifyAccess.allowed) {
      return res.status(403).json({
        error: verifyAccess.reason,
        code: verifyAccess.code,
        upgradeMessage: verifyAccess.upgradeMessage,
        upgradeUrl: verifyAccess.upgradeUrl,
      });
    }

    const previousRecord = latestVerificationDoc?.exists ? latestVerificationDoc.data() : null;
    const verificationRecord = buildVerificationRecord({
      uid,
      documents,
      userData: targetUserData,
      profileData: targetProfileData,
      previousRecord,
      now: new Date().toISOString(),
    });
    const validation = validateVerificationRecord(verificationRecord);

    if (!verificationRecord.summary.requestedCount) {
      return res.status(400).json({ error: 'Selecione pelo menos um tipo de verificação para enviar.' });
    }

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.issues[0]?.reason || 'Existem tipos de verificação sem dados mínimos.',
        issues: validation.issues,
      });
    }

    const allRequestedAlreadyApproved =
      verificationRecord.summary.pendingCount === 0 &&
      verificationRecord.summary.requestedCount > 0 &&
      verificationRecord.summary.approvedCount === verificationRecord.summary.requestedCount;

    if (allRequestedAlreadyApproved) {
      return res.status(400).json({
        error: 'Os tipos selecionados já estão aprovados na sua verificação atual.',
        status: 'approved',
        code: 'ALREADY_APPROVED',
      });
    }

    const payload = {
      uid,
      status: verificationRecord.status,
      companyName: safeCompanyName,
      documents: verificationRecord.documents,
      requestedTypes: verificationRecord.requestedTypes,
      verificationItems: verificationRecord.verificationItems,
      summary: verificationRecord.summary,
      profileSnapshot: verificationRecord.profileSnapshot,
      submittedBy: decodedToken.uid,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: latestVerificationDoc?.exists
        ? latestVerificationDoc.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
    };

    let verificationRef = null;
    let updated = false;

    if (latestVerificationDoc?.exists) {
      verificationRef = latestVerificationDoc.ref;
      await verificationRef.set(
        {
          ...payload,
          resubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      updated = true;
    } else {
      verificationRef = await admin.firestore().collection('verifications').add(payload);
    }

    const savedDoc = await verificationRef.get();
    const savedRecord = buildVerificationResponse(savedDoc);
    await syncVerificationState(uid, verificationRef.id, savedRecord);

    await admin.firestore().collection('audit_logs').add({
      action: updated ? 'VERIFICATION_UPDATED' : 'VERIFICATION_REQUESTED',
      userId: uid,
      initiatedBy: decodedToken.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        verificationId: verificationRef.id,
        companyName: safeCompanyName,
        requestedTypes: verificationRecord.requestedTypes,
      },
    });

    return res.status(updated ? 200 : 201).json({
      id: verificationRef.id,
      message: updated
        ? 'Verificação atualizada com sucesso.'
        : 'Verificação solicitada com sucesso.',
      status: savedRecord.status,
      updated,
      verification: savedRecord,
    });
  } catch (error) {
    logServerError('verifications.criar_verificacao_failed', error);
    return res.status(500).json({ error: 'Erro ao solicitar verificação' });
  }
}

async function handleGet(req, res, decodedToken) {
  try {
    const { uid, status } = req.query;

    let query = admin.firestore().collection('verifications');

    if (uid) {
      const requesterIsAdmin = await isAdminUser(decodedToken.uid);
      if (decodedToken.uid !== uid && !requesterIsAdmin) {
        return res.status(403).json({ error: 'Sem permissão' });
      }

      query = query.where('uid', '==', uid);
      if (!status) {
        const snapshot = await query.get();
        const docs = snapshot.docs.sort((a, b) => {
          const timeA =
            a.data().updatedAt?.toDate?.()?.getTime?.() ||
            a.data().submittedAt?.toDate?.()?.getTime?.() ||
            0;
          const timeB =
            b.data().updatedAt?.toDate?.()?.getTime?.() ||
            b.data().submittedAt?.toDate?.()?.getTime?.() ||
            0;
          return timeB - timeA;
        });

        const latestDoc = docs[0];
        const verifications = latestDoc ? [buildVerificationResponse(latestDoc)] : [];
        return res.status(200).json({ verifications });
      }
    } else {
      const requesterIsAdmin = await isAdminUser(decodedToken.uid);
      if (!requesterIsAdmin) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const verifications = snapshot.docs
      .map((doc) => buildVerificationResponse(doc))
      .sort((a, b) => new Date(b.updatedAt || b.submittedAt || 0).getTime() - new Date(a.updatedAt || a.submittedAt || 0).getTime());

    return res.status(200).json({ verifications });
  } catch (error) {
    logServerError('verifications.buscar_verificacoes_failed', error);
    return res.status(500).json({ error: 'Erro ao buscar verificações' });
  }
}

async function handlePut(req, res, decodedToken) {
  try {
    const { id, status, reason = '', verificationType = null } = req.body || {};

    if (!id || !status) {
      return res.status(400).json({ error: 'ID e status são obrigatórios' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const requesterIsAdmin = await isAdminUser(decodedToken.uid);
    if (!requesterIsAdmin) {
      return res.status(403).json({ error: 'Acesso negado - admin requerido' });
    }

    const verificationRef = admin.firestore().collection('verifications').doc(id);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return res.status(404).json({ error: 'Verificação não encontrada' });
    }

    const verificationData = serializeVerificationTimestamps(verificationDoc.data() || {});
    const targetItem = verificationType ? verificationData.verificationItems?.[verificationType] : null;
    if (verificationType && !targetItem) {
      return res.status(404).json({ error: 'Tipo de verificação não encontrado neste pedido' });
    }
    if (verificationType && targetItem.status !== 'pending') {
      return res.status(400).json({ error: 'Este tipo de verificação já foi analisado' });
    }

    const reviewedRecord = reviewVerificationRecord(verificationData, {
      action: status === 'approved' ? 'approve' : 'reject',
      verificationType,
      reviewerId: decodedToken.uid,
      reason,
      now: new Date().toISOString(),
    });

    await verificationRef.set(
      {
        status: reviewedRecord.status,
        verificationItems: reviewedRecord.verificationItems,
        summary: reviewedRecord.summary,
        reviewReason: reason || '',
        reviewedBy: decodedToken.uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const savedDoc = await verificationRef.get();
    const savedRecord = buildVerificationResponse(savedDoc);
    await syncVerificationState(verificationData.uid, id, savedRecord);

    await admin.firestore().collection('audit_logs').add({
      action: verificationType
        ? `VERIFICATION_ITEM_${status.toUpperCase()}`
        : `VERIFICATION_${status.toUpperCase()}`,
      adminId: decodedToken.uid,
      userId: verificationData.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        verificationId: id,
        verificationType,
        reason,
      },
    });

    return res.status(200).json({
      message: `Verificação ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso`,
      verification: savedRecord,
    });
  } catch (error) {
    logServerError('verifications.atualizar_verificacao_failed', error);
    return res.status(500).json({ error: 'Erro ao atualizar verificação' });
  }
}
