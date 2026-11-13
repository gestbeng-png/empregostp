import { admin } from '../../lib/firebaseAdmin';
import {
  canVerifyProfile,
  getPlanSummary,
} from '../../lib/candidatePlanFeatures';
import {
  buildVerificationRecord,
  buildVerificationStateUpdate,
  getVerificationApprovalEligibility,
  getVerificationRecordTime,
  reviewVerificationRecord,
  serializeVerificationTimestamps,
  validateVerificationRecord,
} from '../../lib/candidateVerification';
import { logServerError } from '../../lib/serverLog';
import { requireActiveApiUser } from '../../lib/apiUserAuth';
import { validateCompetencyLinks } from '../../lib/candidateVerificationLinks';

async function isAdminUser(uid) {
  if (!uid) return false;
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.userType === 'admin';
}

async function getLatestVerificationByUid(uid) {
  const snapshot = await admin
    .firestore()
    .collection('verifications')
    .where('uid', '==', uid)
    .get();
  const docs = snapshot.docs.sort(
    (a, b) =>
      getVerificationRecordTime(b.data()) - getVerificationRecordTime(a.data()),
  );

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

function syncVerificationState(batch, uid, verificationId, record) {
  const update = buildVerificationStateUpdate(
    verificationId,
    record,
    admin.firestore.FieldValue.serverTimestamp(),
  );
  for (const collection of ['users', 'profiles']) {
    batch.set(admin.firestore().collection(collection).doc(uid), update, {
      merge: true,
    });
  }
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
    return res
      .status(500)
      .json({ error: 'Erro interno do servidor', details: error.message });
  }
}

async function handlePost(req, res, decodedToken) {
  try {
    const {
      uid,
      documents = {},
      companyName = '',
      verificationMethod = 'paid',
    } = req.body || {};
    if (!['paid', 'competencies'].includes(verificationMethod)) {
      return res
        .status(400)
        .json({ error: 'Escolha uma opção de verificação válida.' });
    }
    if (verificationMethod === 'competencies') {
      const supportingLinks = validateCompetencyLinks(documents.supportingLinks);
      if (supportingLinks.error) {
        return res.status(400).json({ error: supportingLinks.error });
      }
      const email = String(documents.contact?.email || '').trim();
      const phone = String(documents.contact?.phone || '').trim();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        phone.length < 3 ||
        phone.length > 30
      ) {
        return res
          .status(400)
          .json({
            error: 'Preencha um email e telefone válidos para contacto.',
          });
      }
      const experience = String(documents.experienceSummary || '').trim();
      const skills = String(documents.competencyNotes || '').trim();
      const supportingLink = String(
        documents.portfolioUrl || documents.linkedin || '',
      ).trim();
      const supportingFile = documents.competencyDocument?.url;
      if (
        experience.length > 4000 ||
        skills.length > 4000 ||
        supportingLink.length > 2000 ||
        String(documents.educationSummary || '').length > 3000
      ) {
        return res
          .status(400)
          .json({
            error: 'O pedido ultrapassa os limites de texto permitidos.',
          });
      }
      if (
        experience.length < 30 ||
        skills.length < 20 ||
        (!supportingLink && !supportingFile && !supportingLinks.links.length)
      ) {
        return res
          .status(400)
          .json({
            error:
              'Descreva a experiência e as competências e inclua um comprovativo ou link para análise.',
          });
      }
      if (supportingLink) {
        try {
          const url = new URL(supportingLink);
          if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
        } catch {
          return res
            .status(400)
            .json({ error: 'Introduza um link completo válido (https://…).' });
        }
      }
      if (
        !Array.isArray(documents.requestedTypes) ||
        documents.requestedTypes.length !== 1 ||
        documents.requestedTypes[0] !== 'competencies'
      ) {
        return res
          .status(400)
          .json({ error: 'Pedido de avaliação de competências inválido.' });
      }
    }
    const safeCompanyName =
      typeof companyName === 'string' ? companyName.trim() : '';

    if (!uid) {
      return res.status(400).json({ error: 'UID não fornecido' });
    }

    const requesterIsAdmin = await isAdminUser(decodedToken.uid);
    if (decodedToken.uid !== uid && !requesterIsAdmin) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const [targetUserDoc, targetProfileDoc, latestVerificationDoc] =
      await Promise.all([
        admin.firestore().collection('users').doc(uid).get(),
        admin.firestore().collection('profiles').doc(uid).get(),
        getLatestVerificationByUid(uid),
      ]);

    if (!targetUserDoc.exists) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const targetUserData = targetUserDoc.data() || {};
    const targetProfileData = targetProfileDoc.exists
      ? targetProfileDoc.data()
      : {};

    if (targetUserData.userType !== 'candidato') {
      return res.status(403).json({
        error: 'A verificação de perfil está disponível apenas para candidatos',
      });
    }

    const targetUserRef = targetUserDoc.ref;
    const planSummary = getPlanSummary(targetUserData);

    if (
      targetUserData.currentPlan &&
      targetUserData.currentPlan !== planSummary.planId
    ) {
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
        logServerError(
          'verifications.sincronizar_plano_para_verificacao_failed',
          planSyncError,
        );
      }
    }

    const verifyAccess = canVerifyProfile(planSummary.planId);
    if (verificationMethod !== 'competencies' && !verifyAccess.allowed) {
      return res.status(403).json({
        error: verifyAccess.reason,
        code: verifyAccess.code,
        upgradeMessage: verifyAccess.upgradeMessage,
        upgradeUrl: verifyAccess.upgradeUrl,
      });
    }

    const previousRecord = latestVerificationDoc?.exists
      ? latestVerificationDoc.data()
      : null;
    if (
      verificationMethod === 'competencies' &&
      !String(targetProfileData.cvUrl || targetUserData.cvUrl || '').trim()
    ) {
      return res
        .status(400)
        .json({
          error: 'Adicione o seu CV no perfil antes de pedir a avaliação.',
          code: 'VERIFICATION_MISSING_CV',
        });
    }
    if (verificationMethod === 'competencies' && previousRecord?.summary?.pendingCount > 0) {
      return res
        .status(409)
        .json({
          error: 'Já tem um pedido de verificação em análise.',
          code: 'VERIFICATION_PENDING',
        });
    }
    const verificationRecord = buildVerificationRecord({
      uid,
      documents,
      userData: targetUserData,
      profileData: targetProfileData,
      previousRecord,
      verificationMethod,
      now: new Date().toISOString(),
    });
    const validation = validateVerificationRecord(verificationRecord);

    if (!verificationRecord.submittedTypes.length) {
      return res.status(400).json({
        error: 'Selecione pelo menos um tipo de verificação para enviar.',
      });
    }

    if (!validation.valid) {
      return res.status(400).json({
        error:
          validation.issues[0]?.reason ||
          'Existem tipos de verificação sem dados mínimos.',
        issues: validation.issues,
      });
    }

    const allRequestedAlreadyApproved = verificationRecord.submittedTypes.every(
      (type) =>
        verificationRecord.verificationItems[type]?.status === 'approved',
    );

    if (allRequestedAlreadyApproved) {
      return res.status(400).json({
        error:
          'Os tipos selecionados já estão aprovados na sua verificação atual.',
        status: 'approved',
        code: 'ALREADY_APPROVED',
      });
    }

    const payload = {
      uid,
      verificationMethod,
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
        ? latestVerificationDoc.data()?.createdAt ||
          admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
    };

    const batch = admin.firestore().batch();
    let verificationRef = null;
    let updated = false;

    if (latestVerificationDoc?.exists) {
      verificationRef = latestVerificationDoc.ref;
      batch.set(
        verificationRef,
        {
          ...payload,
          resubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      updated = true;
    } else {
      verificationRef = admin.firestore().collection('verifications').doc();
      batch.set(verificationRef, payload);
    }

    syncVerificationState(batch, uid, verificationRef.id, verificationRecord);

    batch.set(admin.firestore().collection('audit_logs').doc(), {
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

    await batch.commit();
    const savedRecord = buildVerificationResponse(await verificationRef.get());

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
        const docs = snapshot.docs.sort(
          (a, b) =>
            getVerificationRecordTime(b.data()) -
            getVerificationRecordTime(a.data()),
        );

        const latestDoc = docs[0];
        const verifications = latestDoc
          ? [buildVerificationResponse(latestDoc)]
          : [];
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
      .sort(
        (a, b) => getVerificationRecordTime(b) - getVerificationRecordTime(a),
      );

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

    const verificationRef = admin
      .firestore()
      .collection('verifications')
      .doc(id);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return res.status(404).json({ error: 'Verificação não encontrada' });
    }

    const verificationData = serializeVerificationTimestamps(
      verificationDoc.data() || {},
    );
    const targetItem = verificationType
      ? verificationData.verificationItems?.[verificationType]
      : null;
    if (verificationType && !targetItem) {
      return res
        .status(404)
        .json({ error: 'Tipo de verificação não encontrado neste pedido' });
    }
    if (verificationType && targetItem.status !== 'pending') {
      return res
        .status(400)
        .json({ error: 'Este tipo de verificação já foi analisado' });
    }
    if (
      !verificationType &&
      !Object.values(verificationData.verificationItems || {}).some(
        (item) => item?.status === 'pending',
      )
    ) {
      return res
        .status(400)
        .json({ error: 'Esta verificação já foi analisada' });
    }
    if (status === 'approved') {
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
      action: status === 'approved' ? 'approve' : 'reject',
      verificationType,
      reviewerId: decodedToken.uid,
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
        reviewReason: reason || '',
        reviewedBy: decodedToken.uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    syncVerificationState(batch, verificationData.uid, id, reviewedRecord);

    batch.set(admin.firestore().collection('audit_logs').doc(), {
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

    await batch.commit();
    const savedRecord = buildVerificationResponse(await verificationRef.get());

    return res.status(200).json({
      message: `Verificação ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso`,
      verification: savedRecord,
    });
  } catch (error) {
    logServerError('verifications.atualizar_verificacao_failed', error);
    return res.status(500).json({ error: 'Erro ao atualizar verificação' });
  }
}
