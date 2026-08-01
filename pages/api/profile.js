import { admin } from '../../lib/firebaseAdmin';
import { logServerError } from '../../lib/serverLog';

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

const serializeDeep = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => serializeDeep(item));
  if (typeof value.toDate === 'function' || value instanceof Date) return serializeTimestamp(value);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, serializeDeep(currentValue)])
    );
  }
  return value;
};

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization;
    let authenticatedUid = null;
    let isAdmin = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      authenticatedUid = decodedToken.uid;

      const requesterDoc = await admin.firestore().collection('users').doc(authenticatedUid).get();
      if (requesterDoc.exists) {
        isAdmin = requesterDoc.data().userType === 'admin';
      }
    }

    const requestedUid = req.method === 'POST' ? req.body.uid : req.query.uid;
    const uid = requestedUid || authenticatedUid;

    if (!uid || !authenticatedUid) {
      return res.status(401).json({ error: 'Token de autenticação obrigatório' });
    }

    if (uid !== authenticatedUid && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para acessar este perfil' });
    }

    const [profileSnap, userSnap] = await Promise.all([
      admin.firestore().collection('profiles').doc(uid).get(),
      admin.firestore().collection('users').doc(uid).get()
    ]);

    if (!profileSnap.exists && !userSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const profileData = profileSnap.exists ? profileSnap.data() : {};
    const userData = userSnap.exists ? userSnap.data() : {};

    const mergedProfile = {
      ...profileData,
      fullName: userData.name || userData.fullName || profileData.fullName || '',
      email: userData.email || profileData.email || '',
      phone: userData.phone || profileData.phone || '',
      userType: userData.userType || profileData.userType || '',
      cvUrl: userData.cvUrl || profileData.cvUrl || '',
      cvName: userData.cvName || profileData.cvName || '',
      photoUrl: userData.photoUrl || profileData.photoUrl || '',
      coverUrl: userData.coverUrl || profileData.coverUrl || '',
      currentPlan: userData.currentPlan || null,
      planId: userData.planId || null,
      planEndDate: serializeTimestamp(userData.planEndDate),
      planName: userData.planName || null,
      planFeatures: userData.planFeatures || [],
      curriculoDestacado: Boolean(userData.curriculoDestacado),
      vagasLimit: userData.vagasLimit ?? null,
      destaque: Boolean(userData.destaque),
      verificationStatus: userData.verificationStatus || profileData.verificationStatus || 'unverified',
      verificationSummary: serializeDeep(userData.verificationSummary || profileData.verificationSummary || null),
      verificationItems: serializeDeep(userData.verificationItems || profileData.verificationItems || null),
      verificationId: userData.verificationId || profileData.verificationId || null
    };

    let applications = [];
    if (isAdmin || authenticatedUid === uid) {
      const appsSnap = await admin
        .firestore()
        .collection('applications')
        .where('candidateId', '==', uid)
        .get();

      applications = appsSnap.docs.map((doc) => {
        const data = doc.data();
        const timeline = Array.isArray(data.timeline)
          ? data.timeline.map((event) => ({
              ...event,
              date: serializeTimestamp(event.date)
            }))
          : [];
        return {
          id: doc.id,
          ...data,
          timeline,
          interviewDetails: data.interviewDetails
            ? {
                ...data.interviewDetails,
                scheduledAt: serializeTimestamp(data.interviewDetails.scheduledAt),
                updatedAt: serializeTimestamp(data.interviewDetails.updatedAt),
                confirmedAt: serializeTimestamp(data.interviewDetails.confirmedAt),
                rescheduleRequestedAt: serializeTimestamp(data.interviewDetails.rescheduleRequestedAt),
                candidateRespondedAt: serializeTimestamp(data.interviewDetails.candidateRespondedAt)
              }
            : null,
          appliedAt: serializeTimestamp(data.appliedAt),
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt)
        };
      });
    }

    return res.status(200).json({
      profile: {
        id: uid,
        data: serializeDeep(mergedProfile)
      },
      applications
    });
  } catch (error) {
    logServerError('profile.api_de_perfil_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
