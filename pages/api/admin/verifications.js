import { admin } from '../../../lib/firebaseAdmin';
import { serializeVerificationTimestamps } from '../../../lib/candidateVerification';
import { canVerifyProfile } from '../../../lib/candidatePlanFeatures';
import { logServerError } from '../../../lib/serverLog';

function getDocTime(data = {}) {
  return (
    data.updatedAt?.toDate?.()?.getTime?.() ||
    data.submittedAt?.toDate?.()?.getTime?.() ||
    data.createdAt?.toDate?.()?.getTime?.() ||
    0
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', String(Date.now()));

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminUid = decodedToken.uid;

    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(adminUid)
      .get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Forbidden - Admin access required' });
    }

    const verificationsSnapshot = await admin
      .firestore()
      .collection('verifications')
      .get();
    const latestByUser = new Map();

    verificationsSnapshot.docs.forEach((doc) => {
      const currentData = doc.data() || {};
      const existing = latestByUser.get(currentData.uid);
      if (!existing || getDocTime(currentData) > getDocTime(existing.data)) {
        latestByUser.set(currentData.uid, { doc, data: currentData });
      }
    });

    const sortedDocs = Array.from(latestByUser.values())
      .sort((a, b) => getDocTime(b.data) - getDocTime(a.data))
      .slice(0, 100);

    const verifications = [];
    for (const entry of sortedDocs) {
      const verificationData = serializeVerificationTimestamps(
        entry.data || {},
      );
      let candidateInfo = {
        name: 'Desconhecido',
        email:
          verificationData.profileSnapshot?.email ||
          verificationData.documents?.contact?.email ||
          'Não informado',
      };
      let cvUrl = '';
      let cvName = '';
      let currentPlan = 'basic_candidato';

      try {
        const userDoc = await admin
          .firestore()
          .collection('users')
          .doc(verificationData.uid)
          .get();
        if (userDoc.exists) {
          const userData = userDoc.data() || {};
          candidateInfo.name =
            userData.fullName ||
            userData.name ||
            userData.displayName ||
            'Desconhecido';
          if (!candidateInfo.email || candidateInfo.email === 'Não informado') {
            candidateInfo.email = userData.email || 'Não informado';
          }
          cvUrl = userData.cvUrl || '';
          cvName = userData.cvName || '';
          currentPlan = userData.currentPlan || 'basic_candidato';
        }
      } catch (err) {
        logServerError('admin_verifications.fetching_user_info_failed', err);
      }

      // O admin só deve poder aprovar depois de ver o CV atual do perfil e de
      // confirmar que o plano do candidato ainda cobre a verificação (pagamento
      // confirmado) — ver pages/api/admin/verify-action.js, que aplica o mesmo
      // gate no momento da aprovação.
      const hasCv = Boolean(String(cvUrl || '').trim());
      const planAccess = canVerifyProfile(currentPlan);
      const approvalEligibility = !hasCv
        ? {
            allowed: false,
            code: 'VERIFICATION_MISSING_CV',
            reason: 'O candidato ainda não anexou um currículo (CV) ao perfil.',
          }
        : !planAccess.allowed
          ? {
              allowed: false,
              code: 'VERIFICATION_PLAN_NOT_ELIGIBLE',
              reason:
                'O plano atual do candidato já não inclui verificação de perfil (pagamento não confirmado).',
            }
          : { allowed: true };

      verifications.push({
        id: entry.doc.id,
        uid: verificationData.uid,
        candidateName: candidateInfo.name,
        candidateEmail: candidateInfo.email,
        status: verificationData.status,
        submittedAt: verificationData.submittedAt || null,
        updatedAt: verificationData.updatedAt || null,
        summary: verificationData.summary || null,
        requestedTypes: verificationData.requestedTypes || [],
        verificationItems: verificationData.verificationItems || {},
        profileSnapshot: verificationData.profileSnapshot || {},
        cvUrl,
        cvName,
        currentPlan,
        approvalEligibility,
      });
    }

    return res.status(200).json({ verifications });
  } catch (error) {
    logServerError('admin_verifications.fetching_verifications_failed', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', details: error.message });
  }
}
