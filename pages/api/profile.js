import { admin } from '../../lib/firebaseAdmin';
import { logServerError } from '../../lib/serverLog';
import { requireActiveApiUser } from '../../lib/apiUserAuth';
import { buildCandidateVisibility } from '../../lib/candidateProfileInsights';

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

const serializeDeep = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => serializeDeep(item));
  if (typeof value.toDate === 'function' || value instanceof Date)
    return serializeTimestamp(value);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [
        key,
        serializeDeep(currentValue),
      ]),
    );
  }
  return value;
};

export default async function handler(req, res) {
  // Perfil autenticado: não permitir que ETag/304 retire o corpo JSON que o
  // dashboard precisa para decidir o destino da sessão.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  // A rota apenas lê o perfil; POST existe só para receber o uid no corpo.
  // Sem este guard, um DELETE ou PUT era servido como se fosse um GET.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      missingTokenMessage: 'Token de autenticação obrigatório',
    });
    if (!authResult) return;
    const {
      uid: authenticatedUid,
      userData: requesterData,
      userDoc: requesterDoc,
    } = authResult;
    const isAdmin = requesterData.userType === 'admin';

    const requestedUid = req.method === 'POST' ? req.body.uid : req.query.uid;
    const uid = requestedUid || authenticatedUid;

    if (!uid) {
      return res
        .status(401)
        .json({ error: 'Token de autenticação obrigatório' });
    }

    if (uid !== authenticatedUid && !isAdmin) {
      return res
        .status(403)
        .json({ error: 'Sem permissão para acessar este perfil' });
    }

    const [profileSnap, userSnap] = await Promise.all([
      admin.firestore().collection('profiles').doc(uid).get(),
      uid === authenticatedUid
        ? Promise.resolve(requesterDoc)
        : admin.firestore().collection('users').doc(uid).get(),
    ]);

    if (!profileSnap.exists && !userSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const profileData = profileSnap.exists ? profileSnap.data() : {};
    const userData = userSnap.exists ? userSnap.data() : {};
    const candidateVisibility =
      userData.userType === 'candidato'
        ? buildCandidateVisibility(userData, profileData)
        : null;
    const verificationReviewStatus =
      userData.verificationStatus ||
      profileData.verificationStatus ||
      'unverified';

    const mergedProfile = {
      ...profileData,
      fullName:
        userData.name || userData.fullName || profileData.fullName || '',
      email: userData.email || profileData.email || '',
      phone: userData.phone || profileData.phone || '',
      userType: userData.userType || profileData.userType || '',
      cvUrl: userData.cvUrl || profileData.cvUrl || '',
      cvName: userData.cvName || profileData.cvName || '',
      cvUpdatedAt: userData.cvUpdatedAt || profileData.cvUpdatedAt || '',
      photoUrl: userData.photoUrl || profileData.photoUrl || '',
      coverUrl: userData.coverUrl || profileData.coverUrl || '',
      currentPlan: userData.currentPlan || null,
      planTierId: userData.planTierId || null,
      planId: userData.planId || null,
      planStartDate: serializeTimestamp(userData.planStartDate),
      planEndDate: serializeTimestamp(userData.planEndDate),
      planName: userData.planName || null,
      planFeatures: userData.planFeatures || [],
      curriculoDestacado: Boolean(userData.curriculoDestacado),
      vagasLimit: userData.vagasLimit ?? null,
      destaque: Boolean(userData.destaque),
      verificationReviewStatus,
      verificationStatus: candidateVisibility
        ? candidateVisibility.verified
          ? 'verified'
          : userData.verificationDisabled === true
            ? 'revoked'
            : ['verified', 'approved'].includes(verificationReviewStatus)
              ? 'unverified'
              : verificationReviewStatus
        : verificationReviewStatus,
      ...(candidateVisibility
        ? {
            verified: candidateVisibility.verified,
            verificado: candidateVisibility.verified,
            isVerified: candidateVisibility.verified,
          }
        : {}),
      verificationDisabled: userData.verificationDisabled === true,
      verificationSummary: serializeDeep(
        userData.verificationSummary || profileData.verificationSummary || null,
      ),
      verificationItems: serializeDeep(
        userData.verificationItems || profileData.verificationItems || null,
      ),
      verificationId:
        userData.verificationId || profileData.verificationId || null,
      verificationMethod:
        userData.verificationMethod || profileData.verificationMethod || null,
      verificationTypes:
        candidateVisibility?.verificationTypes ||
        userData.verificationTypes ||
        profileData.verificationTypes ||
        [],
      verificationType:
        candidateVisibility?.verificationType ||
        userData.verificationType ||
        profileData.verificationType ||
        null,
      paidVerified: Boolean(candidateVisibility?.paidVerified),
      premiumVerified: Boolean(candidateVisibility?.premiumVerified),
      qualifiedVerified: Boolean(candidateVisibility?.qualifiedVerified),
      qualificationScore: candidateVisibility?.qualificationScore || 0,
      qualificationLabel: candidateVisibility?.qualificationLabel || null,
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
              date: serializeTimestamp(event.date),
            }))
          : [];
        return {
          id: doc.id,
          ...data,
          timeline,
          interviewDetails: data.interviewDetails
            ? {
                ...data.interviewDetails,
                scheduledAt: serializeTimestamp(
                  data.interviewDetails.scheduledAt,
                ),
                updatedAt: serializeTimestamp(data.interviewDetails.updatedAt),
                confirmedAt: serializeTimestamp(
                  data.interviewDetails.confirmedAt,
                ),
                rescheduleRequestedAt: serializeTimestamp(
                  data.interviewDetails.rescheduleRequestedAt,
                ),
                candidateRespondedAt: serializeTimestamp(
                  data.interviewDetails.candidateRespondedAt,
                ),
              }
            : null,
          appliedAt: serializeTimestamp(data.appliedAt),
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        };
      });
    }

    return res.status(200).json({
      profile: {
        id: uid,
        data: serializeDeep(mergedProfile),
      },
      applications,
    });
  } catch (error) {
    logServerError('profile.api_de_perfil_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
