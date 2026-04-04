import { admin } from '../../../lib/firebaseAdmin';
import { canUploadCertificate, getPlanSummary } from '../../../lib/candidatePlanFeatures';
import { extractLinkedInProfileHints, normalizeLinkedInUrl } from '../../../lib/linkedin';

const normalizeSkills = (value) => {
  if (Array.isArray(value)) {
    return value.map((skill) => (typeof skill === 'string' ? skill.trim() : '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((skill) => skill.trim()).filter(Boolean);
  }
  return [];
};

const normalizeExperiences = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      company: (item.company || '').trim(),
      role: (item.role || '').trim(),
      period: (item.period || '').trim(),
      description: (item.description || '').trim()
    }))
    .filter((item) => item.company || item.role || item.period || item.description);
};

const mapPlanInfo = (userData) => ({
  currentPlan: userData.currentPlan,
  planId: userData.planId,
  planName: userData.planName,
  planEndDate: userData.planEndDate
    ? userData.planEndDate.toDate
      ? userData.planEndDate.toDate().toISOString()
      : userData.planEndDate
    : null,
  planFeatures: userData.planFeatures,
  destaque: userData.destaque,
  curriculoDestacado: userData.curriculoDestacado,
  vagasLimit: userData.vagasLimit
});

const mapProfileResponse = (userData, profileData) => ({
  ...profileData,
  fullName: userData.name || userData.fullName || '',
  email: userData.email,
  userType: userData.userType,
  phone: userData.phone || profileData.phone || '',
  photoUrl: userData.photoUrl || profileData.photoUrl || '',
  coverUrl: userData.coverUrl || profileData.coverUrl || '',
  cvUrl: userData.cvUrl || profileData.cvUrl || '',
  cvName: userData.cvName || profileData.cvName || '',
  verificationStatus: userData.verificationStatus || profileData.verificationStatus || 'unverified',
  ...mapPlanInfo(userData)
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const userRef = admin.firestore().collection('users').doc(uid);
    const profileRef = admin.firestore().collection('profiles').doc(uid);

    const existingUserSnap = await userRef.get();
    if (!existingUserSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const existingUserData = existingUserSnap.data() || {};

    const { name, headline, bio, location, phone, skills, experiences, photoUrl, coverUrl } = req.body;

    const userUpdates = {};
    if (name) userUpdates.name = name;
    if (phone !== undefined) userUpdates.phone = phone;
    if (photoUrl !== undefined) userUpdates.photoUrl = photoUrl;
    if (coverUrl !== undefined) userUpdates.coverUrl = coverUrl;

    const profileUpdates = {};
    if (headline !== undefined) profileUpdates.headline = headline;
    if (bio !== undefined) profileUpdates.bio = bio;
    if (location !== undefined) profileUpdates.city = location;
    if (phone !== undefined) profileUpdates.phone = phone;
    if (photoUrl !== undefined) profileUpdates.photoUrl = photoUrl;
    if (coverUrl !== undefined) profileUpdates.coverUrl = coverUrl;
    if (skills !== undefined) profileUpdates.skillsHard = normalizeSkills(skills);
    if (experiences !== undefined) profileUpdates.experience = normalizeExperiences(experiences);

    // Extended fields
    const {
      birthDate, nationality, gender, maritalStatus,
      linkedin, website,
      objectiveArea, objectiveType, objectiveAspiration,
      skillsSoft, digitalSkills,
      education, languages, certifications, certificateFiles
    } = req.body;

    if (birthDate !== undefined) profileUpdates.birthDate = birthDate;
    if (nationality !== undefined) profileUpdates.nationality = nationality;
    if (gender !== undefined) profileUpdates.gender = gender;
    if (maritalStatus !== undefined) profileUpdates.maritalStatus = maritalStatus;
    if (linkedin !== undefined) {
      const normalizedLinkedin = normalizeLinkedInUrl(linkedin);
      const linkedinHints = extractLinkedInProfileHints(normalizedLinkedin);
      profileUpdates.linkedin = normalizedLinkedin;
      if (!name && !existingUserData.name && linkedinHints.inferredName) {
        userUpdates.name = linkedinHints.inferredName;
      }
    }
    if (website !== undefined) profileUpdates.website = website;
    if (objectiveArea !== undefined) profileUpdates.objectiveArea = objectiveArea;
    if (objectiveType !== undefined) profileUpdates.objectiveType = objectiveType;
    if (objectiveAspiration !== undefined) profileUpdates.objectiveAspiration = objectiveAspiration;
    if (skillsSoft !== undefined) profileUpdates.skillsSoft = skillsSoft; // string
    if (digitalSkills !== undefined) profileUpdates.digitalSkills = digitalSkills; // array
    if (education !== undefined) profileUpdates.education = education; // string (textarea)
    if (languages !== undefined) profileUpdates.languages = languages; // string (textarea)
    if (certifications !== undefined) profileUpdates.certifications = certifications; // string (textarea)
    if (certificateFiles !== undefined) {
      if (existingUserData.userType !== 'candidato') {
        return res.status(403).json({ error: 'Apenas candidatos podem gerir certificados' });
      }

      const nextCertificates = Array.isArray(certificateFiles) ? certificateFiles : [];
      const planSummary = getPlanSummary(existingUserData);

      if (existingUserData.currentPlan && existingUserData.currentPlan !== planSummary.planId) {
        userUpdates.currentPlan = 'basic_candidato';
        userUpdates.planId = 'basic_candidato';
        userUpdates.planName = 'Básico';
        userUpdates.planEndDate = null;
      }

      const certificateAccess = canUploadCertificate(planSummary.planId, nextCertificates.length);
      if (!certificateAccess.allowed) {
        return res.status(403).json({
          error: certificateAccess.reason,
          code: certificateAccess.code,
          current: certificateAccess.current,
          limit: certificateAccess.limit,
          upgradeMessage: certificateAccess.upgradeMessage,
          upgradeUrl: certificateAccess.upgradeUrl
        });
      }

      profileUpdates.certificateFiles = nextCertificates;
    }

    if (Object.keys(userUpdates).length) {
      await userRef.update(userUpdates);
    }
    if (Object.keys(profileUpdates).length) {
      await profileRef.set(profileUpdates, { merge: true });
    }

    const [userSnap, profileSnap] = await Promise.all([userRef.get(), profileRef.get()]);
    const userData = userSnap.data() || {};
    const profileData = profileSnap.data() || {};

    const mergedProfile = mapProfileResponse(userData, profileData);

    return res.status(200).json({
      profile: mergedProfile,
      message: 'Perfil atualizado com sucesso.'
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar o perfil.' });
  }
}
