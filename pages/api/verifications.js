import { admin } from '../../lib/firebaseAdmin';
import { canVerifyProfile, getPlanSummary } from '../../lib/candidatePlanFeatures';

function sanitizeFirestoreValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeFirestoreValue(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const result = {};
    Object.entries(value).forEach(([key, val]) => {
      const next = sanitizeFirestoreValue(val);
      if (next !== undefined) result[key] = next;
    });
    return result;
  }
  return value;
}

/**
 * API para gerenciar verificações de perfil
 * POST: Solicitar verificação
 * GET: Obter status de verificação
 * PUT: Atualizar status (admin)
 */
export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    if (req.method === 'POST') {
      return handlePost(req, res, decodedToken);
    } else if (req.method === 'GET') {
      return handleGet(req, res, decodedToken);
    } else if (req.method === 'PUT') {
      return handlePut(req, res, decodedToken);
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API de verificações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
}

/**
 * POST: Solicitar nova verificação
 */
async function handlePost(req, res, decodedToken) {
  try {
    const { uid, documents, companyName } = req.body;
    const safeCompanyName = typeof companyName === 'string' ? companyName.trim() : '';
    const safeDocuments = sanitizeFirestoreValue(documents || {}) || {};

    if (!uid) {
      return res.status(400).json({ error: 'UID não fornecido' });
    }

    // Verificar se é o próprio utilizador ou admin
    if (decodedToken.uid !== uid) {
      const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists || userDoc.data().userType !== 'admin') {
        return res.status(403).json({ error: 'Sem permissão' });
      }
    }

    const targetUserRef = admin.firestore().collection('users').doc(uid);
    const targetUserDoc = await targetUserRef.get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const targetUserData = targetUserDoc.data() || {};
    if (targetUserData.userType !== 'candidato') {
      return res.status(403).json({ error: 'A verificação de perfil está disponível apenas para candidatos' });
    }

    const planSummary = getPlanSummary(targetUserData);
    // Sincronização de plano:
    // - Se estiver expirado, volta para básico
    // - Se estiver ativo mas o identificador estiver legacy (ex.: "premium"), normaliza para o planId atual
    if (targetUserData.currentPlan && targetUserData.currentPlan !== planSummary.planId) {
      try {
        if (!planSummary.isActive) {
          await targetUserRef.update({
            currentPlan: 'basic_candidato',
            planId: 'basic_candidato',
            planName: 'Básico',
            planEndDate: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          await targetUserRef.update({
            currentPlan: planSummary.planId,
            planId: planSummary.planId,
            planName: planSummary.planName || targetUserData.planName || '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (planSyncError) {
        console.error('Erro ao sincronizar plano para verificação:', planSyncError);
      }
    }

    const verifyAccess = canVerifyProfile(planSummary.planId);
    if (!verifyAccess.allowed) {
      return res.status(403).json({
        error: verifyAccess.reason,
        code: verifyAccess.code,
        upgradeMessage: verifyAccess.upgradeMessage,
        upgradeUrl: verifyAccess.upgradeUrl
      });
    }

    // Se já existe verificação pendente, atualizamos a existente (reenvio) em vez de bloquear.
    const pendingSnapshot = await admin
      .firestore()
      .collection('verifications')
      .where('uid', '==', uid)
      .where('status', '==', 'pending')
      .get();

    if (!pendingSnapshot.empty) {
      // Escolhe a mais recente por submittedAt/updatedAt.
      const pendingDoc = pendingSnapshot.docs.sort((a, b) => {
        const aTime = a.data().updatedAt?.toDate?.()?.getTime?.() || a.data().submittedAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.data().updatedAt?.toDate?.()?.getTime?.() || b.data().submittedAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      })[0];

      await pendingDoc.ref.update({
        documents: safeDocuments,
        companyName: safeCompanyName,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        resubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        submittedBy: decodedToken.uid,
      });

      await admin.firestore().collection('users').doc(uid).set({
        verificationStatus: 'pending',
        verificationDate: admin.firestore.FieldValue.serverTimestamp(),
        verificationData: safeDocuments,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await admin.firestore().collection('audit_logs').add({
        action: 'VERIFICATION_RESUBMITTED',
        userId: uid,
        initiatedBy: decodedToken.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          verificationId: pendingDoc.id,
          companyName: safeCompanyName,
        },
      });

      return res.status(200).json({
        id: pendingDoc.id,
        message: 'Verificação reenviada com sucesso (pedido atualizado).',
        status: 'pending',
        updated: true,
      });
    }

    // Se já foi aprovado, não cria novo pedido.
    const approvedSnapshot = await admin
      .firestore()
      .collection('verifications')
      .where('uid', '==', uid)
      .where('status', '==', 'approved')
      .limit(1)
      .get();

    if (!approvedSnapshot.empty) {
      return res.status(400).json({
        error: 'O seu perfil já foi aprovado na verificação. Se ainda não aparece como verificado, peça ao suporte para sincronizar.',
        status: 'approved',
        code: 'ALREADY_APPROVED'
      });
    }

    // Criar novo registo de verificação
    const verificationData = {
      uid,
      status: 'pending',
      documents: safeDocuments,
      companyName: safeCompanyName,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      submittedBy: decodedToken.uid,
    };

    const docRef = await admin
      .firestore()
      .collection('verifications')
      .add(verificationData);

    await admin.firestore().collection('users').doc(uid).set({
      verificationStatus: 'pending',
      verificationDate: admin.firestore.FieldValue.serverTimestamp(),
      verificationData: safeDocuments,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Log de auditoria
    await admin.firestore().collection('audit_logs').add({
      action: 'VERIFICATION_REQUESTED',
      userId: uid,
      initiatedBy: decodedToken.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        verificationId: docRef.id,
        companyName: safeCompanyName,
      },
    });

    return res.status(201).json({
      id: docRef.id,
      message: 'Verificação solicitada com sucesso',
      status: 'pending',
    });
  } catch (error) {
    console.error('Erro ao criar verificação:', error);
    return res.status(500).json({ error: 'Erro ao solicitar verificação' });
  }
}

/**
 * GET: Obter status de verificações
 */
async function handleGet(req, res, decodedToken) {
  try {
    const { uid, status } = req.query;

    let query = admin.firestore().collection('verifications');

    // Se passou UID, buscar verificação específica (mais recente)
    if (uid) {
      // Verificar se é o próprio utilizador ou admin
      if (decodedToken.uid !== uid) {
        const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists || userDoc.data().userType !== 'admin') {
          return res.status(403).json({ error: 'Sem permissão' });
        }
      }
      query = query.where('uid', '==', uid);
      // Se não há status específico, buscar apenas a mais recente (ultima tentativa)
      if (!status) {
        query = query.orderBy('updatedAt', 'desc').limit(1);
      }
    } else {
      // Apenas admin pode ver todas as verificações
      const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists || userDoc.data().userType !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    // Filtrar por status se fornecido
    if (status) {
      query = query.where('status', '==', status);
    }

    // Only order if not already limited
    if (!uid || status) {
      query = query.orderBy('submittedAt', 'desc');
    }

    const snapshot = await query.get();

    const verifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        reviewedAt: data.reviewedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return res.status(200).json({ verifications });
  } catch (error) {
    console.error('Erro ao buscar verificações:', error);
    return res.status(500).json({ error: 'Erro ao buscar verificações' });
  }
}

/**
 * PUT: Atualizar status de verificação (admin)
 */
async function handlePut(req, res, decodedToken) {
  try {
    const { id, status, reason } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: 'ID e status são obrigatórios' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    // Verificar se é admin
    const adminDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado - admin requerido' });
    }

    // Obter verificação
    const verificationRef = admin.firestore().collection('verifications').doc(id);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return res.status(404).json({ error: 'Verificação não encontrada' });
    }

    const verificationData = verificationDoc.data();

    // Atualizar verificação
    await verificationRef.update({
      status,
      reviewReason: reason || '',
      reviewedBy: decodedToken.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Atualizar status do utilizador
    const userRef = admin.firestore().collection('users').doc(verificationData.uid);

    if (status === 'approved') {
      await userRef.update({
        verificationStatus: 'verified',
        verified: true,
        verificationId: id,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Sync profile flags for public surfaces (talent pool, public candidates list).
      try {
        await admin.firestore().collection('profiles').doc(verificationData.uid).set({
          verified: true,
          verificationStatus: 'verified',
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (profileErr) {
        console.error('Erro ao sincronizar verificação no perfil:', profileErr);
      }
    } else if (status === 'rejected') {
      await userRef.update({
        verificationStatus: 'rejected',
        verified: false,
        rejectionReason: reason || 'Rejected by admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      try {
        await admin.firestore().collection('profiles').doc(verificationData.uid).set({
          verified: false,
          verificationStatus: 'rejected',
          rejectionReason: reason || 'Rejected by admin',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (profileErr) {
        console.error('Erro ao sincronizar rejeição no perfil:', profileErr);
      }
    }

    // Log de auditoria
    await admin.firestore().collection('audit_logs').add({
      action: `VERIFICATION_${status.toUpperCase()}`,
      adminId: decodedToken.uid,
      userId: verificationData.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        verificationId: id,
        reason,
      },
    });

    return res.status(200).json({
      message: `Verificação ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao atualizar verificação:', error);
    return res.status(500).json({ error: 'Erro ao atualizar verificação' });
  }
}
