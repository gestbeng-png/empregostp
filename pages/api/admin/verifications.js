import { admin } from '../../../lib/firebaseAdmin';
import {
  getVerificationApprovalEligibility,
  getVerificationRecordTime,
  serializeVerificationTimestamps,
} from '../../../lib/candidateVerification';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { logServerError } from '../../../lib/serverLog';

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

    const authResult = await requireActiveApiUser(req, res);
    if (!authResult) return;
    if (authResult.userData.userType !== 'admin') {
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
      if (
        !existing ||
        getVerificationRecordTime(currentData) >
          getVerificationRecordTime(existing.data)
      ) {
        latestByUser.set(currentData.uid, { doc, data: currentData });
      }
    });

    const sortedDocs = Array.from(latestByUser.values())
      .sort(
        (a, b) =>
          getVerificationRecordTime(b.data) - getVerificationRecordTime(a.data),
      )
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
      let approvalEligibility = getVerificationApprovalEligibility();

      try {
        const [userDoc, profileDoc] = await Promise.all([
          admin.firestore().collection('users').doc(verificationData.uid).get(),
          admin
            .firestore()
            .collection('profiles')
            .doc(verificationData.uid)
            .get(),
        ]);
        if (userDoc.exists) {
          const userData = userDoc.data() || {};
          const profileData = profileDoc.data() || {};
          candidateInfo.name =
            userData.fullName ||
            userData.name ||
            userData.displayName ||
            'Desconhecido';
          if (!candidateInfo.email || candidateInfo.email === 'Não informado') {
            candidateInfo.email = userData.email || 'Não informado';
          }
          cvUrl =
            String(profileData.cvUrl || '').trim() ||
            String(userData.cvUrl || '').trim();
          cvName = profileData.cvUrl
            ? profileData.cvName || ''
            : userData.cvName || '';
          currentPlan = userData.currentPlan || 'basic_candidato';
          approvalEligibility = getVerificationApprovalEligibility(
            userData,
            profileData,
            verificationData,
          );
        }
      } catch (err) {
        logServerError('admin_verifications.fetching_user_info_failed', err);
      }

      verifications.push({
        id: entry.doc.id,
        uid: verificationData.uid,
        candidateName: candidateInfo.name,
        candidateEmail: candidateInfo.email,
        status: verificationData.status,
        verificationMethod: verificationData.verificationMethod || 'paid',
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
