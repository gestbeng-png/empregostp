import { admin } from '../../../lib/firebaseAdmin';
import { canUploadCertificate, getPlanSummary } from '../../../lib/candidatePlanFeatures';
import { extractLinkedInProfileHints, normalizeLinkedInUrl } from '../../../lib/linkedin';
import { logServerError } from '../../../lib/serverLog';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { CANDIDATE_PROFILE_LIMITS, limitarTexto } from '../../../lib/candidateProfileLimits';

// `maxLength` no formulário é uma sugestão ao browser; o pedido pode chegar de
// qualquer lado. Os limites voltam a ser aplicados aqui, antes de gravar.
const limitar = (value, campo) =>
  limitarTexto(value, CANDIDATE_PROFILE_LIMITS[campo]);

const normalizeSkills = (value) => {
  const lista = Array.isArray(value)
    ? value.map((skill) => (typeof skill === 'string' ? skill.trim() : ''))
    : typeof value === 'string'
      ? value.split(',').map((skill) => skill.trim())
      : [];

  return lista
    .filter(Boolean)
    .map((skill) => limitar(skill, 'skillTag'))
    .slice(0, 60);
};

const normalizeExperiences = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      company: limitar((item.company || '').trim(), 'experienceCompany'),
      role: limitar((item.role || '').trim(), 'experienceRole'),
      period: limitar((item.period || '').trim(), 'experiencePeriod'),
      description: limitar((item.description || '').trim(), 'experienceDescription')
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

const serializeValue = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => serializeValue(item));
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, serializeValue(currentValue)])
    );
  }
  return value;
};

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
  cvUpdatedAt: userData.cvUpdatedAt || profileData.cvUpdatedAt || '',
  verificationStatus: userData.verificationStatus || profileData.verificationStatus || 'unverified',
  verificationSummary: serializeValue(userData.verificationSummary || profileData.verificationSummary || null),
  verificationItems: serializeValue(userData.verificationItems || profileData.verificationItems || null),
  verificationId: userData.verificationId || profileData.verificationId || null,
  ...mapPlanInfo(userData)
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      missingUserMessage: 'Usuário não encontrado',
    });
    if (!authResult) return;
    const {
      uid,
      userData: existingUserData,
      userRef,
    } = authResult;
    const profileRef = admin.firestore().collection('profiles').doc(uid);

    const { name, headline, bio, location, phone, skills, experiences, photoUrl, coverUrl } = req.body;

    const userUpdates = {};
    if (name) userUpdates.name = limitar(name, 'name');
    if (phone !== undefined) userUpdates.phone = limitar(phone, 'phone');
    if (photoUrl !== undefined) userUpdates.photoUrl = photoUrl;
    if (coverUrl !== undefined) userUpdates.coverUrl = coverUrl;

    const profileUpdates = {};
    if (headline !== undefined) profileUpdates.headline = limitar(headline, 'headline');
    if (bio !== undefined) profileUpdates.bio = limitar(bio, 'bio');
    if (location !== undefined) profileUpdates.city = limitar(location, 'location');
    if (phone !== undefined) profileUpdates.phone = limitar(phone, 'phone');
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
    if (nationality !== undefined) profileUpdates.nationality = limitar(nationality, 'nationality');
    if (gender !== undefined) profileUpdates.gender = gender;
    if (maritalStatus !== undefined) profileUpdates.maritalStatus = limitar(maritalStatus, 'maritalStatus');
    if (linkedin !== undefined) {
      const normalizedLinkedin = normalizeLinkedInUrl(linkedin);
      const linkedinHints = extractLinkedInProfileHints(normalizedLinkedin);
      profileUpdates.linkedin = limitar(normalizedLinkedin, 'linkedin');
      if (!name && !existingUserData.name && linkedinHints.inferredName) {
        userUpdates.name = linkedinHints.inferredName;
      }
    }
    if (website !== undefined) profileUpdates.website = limitar(website, 'website');
    if (objectiveArea !== undefined) profileUpdates.objectiveArea = limitar(objectiveArea, 'objectiveArea');
    if (objectiveType !== undefined) profileUpdates.objectiveType = limitar(objectiveType, 'objectiveType');
    if (objectiveAspiration !== undefined)
      profileUpdates.objectiveAspiration = limitar(objectiveAspiration, 'objectiveAspiration');
    if (skillsSoft !== undefined) profileUpdates.skillsSoft = limitar(skillsSoft, 'skillsSoft'); // string
    if (digitalSkills !== undefined) profileUpdates.digitalSkills = digitalSkills; // array
    if (education !== undefined) profileUpdates.education = limitar(education, 'education'); // string (textarea)
    if (languages !== undefined) profileUpdates.languages = limitar(languages, 'languages'); // string (textarea)
    if (certifications !== undefined)
      profileUpdates.certifications = limitar(certifications, 'certifications'); // string (textarea)
    // O formulário do painel envia `certificateFiles` em todas as gravações,
    // mesmo quando ninguém lhe tocou. Validar a lista sem antes confirmar que
    // ela mudou fazia com que guardar o nome ou a bio pudesse rebentar com
    // "Apenas candidatos podem gerir certificados" — e o perfil todo ficava
    // por gravar. As regras abaixo só se aplicam a alterações reais.
    const nextCertificates = Array.isArray(certificateFiles)
      ? certificateFiles.filter((url) => typeof url === 'string')
      : [];
    let certificatesChanged = false;

    if (certificateFiles !== undefined) {
      const currentProfileSnap = await profileRef.get();
      const currentCertificates = Array.isArray(
        currentProfileSnap.data()?.certificateFiles,
      )
        ? currentProfileSnap
            .data()
            .certificateFiles.filter((url) => typeof url === 'string')
        : [];

      certificatesChanged =
        nextCertificates.length !== currentCertificates.length ||
        nextCertificates.some((url, index) => url !== currentCertificates[index]);
    }

    if (certificatesChanged) {
      if (existingUserData.userType !== 'candidato') {
        return res.status(403).json({ error: 'Apenas candidatos podem gerir certificados' });
      }

      const planSummary = getPlanSummary(existingUserData);

      if (existingUserData.currentPlan && existingUserData.currentPlan !== planSummary.planId) {
        if (!planSummary.isActive) {
          userUpdates.currentPlan = 'basic_candidato';
          userUpdates.planId = 'basic_candidato';
          userUpdates.planName = 'Básico';
          userUpdates.planEndDate = null;
        } else {
          // Normaliza legacy ids (ex.: "premium") sem rebaixar o utilizador.
          userUpdates.currentPlan = planSummary.planId;
          userUpdates.planId = planSummary.planId;
          userUpdates.planName = planSummary.planName || existingUserData.planName || '';
        }
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
      userUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await userRef.update(userUpdates);
    }
    if (Object.keys(profileUpdates).length) {
      profileUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
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
    logServerError('profile_update.atualizar_perfil_failed', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar o perfil.' });
  }
}
