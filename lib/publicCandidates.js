import { buildCandidateVisibility, compareCandidatesByVisibility } from './candidateProfileInsights';
import { canCandidateAppearInTalentPool } from './candidatePrivacy';
import { PREMIUM_CANDIDATE_QUERY_FILTERS } from './candidatePlanFeatures';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : 0;
  }
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toIsoDateString(value) {
  const millis = toMillis(value);
  if (!millis) return null;
  return new Date(millis).toISOString();
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  return [];
}

export async function fetchVerifiedCandidates(admin, access = {}) {
  const db = admin.firestore();
  const maxFetch = Math.min(Math.max(Number(access.maxFetch) || 200, 1), 500);
  const canViewDetailedInfo = Boolean(access.canViewDetailedInfo);

  const candidateSnapshots = await Promise.all([
    db.collection('users').where('userType', '==', 'candidato').where('verified', '==', true).limit(maxFetch).get(),
    db.collection('users').where('userType', '==', 'candidato').where('verificationStatus', '==', 'verified').limit(maxFetch).get(),
    db.collection('users').where('userType', '==', 'candidato').where('verificado', '==', true).limit(maxFetch).get(),
    db.collection('users').where('userType', '==', 'candidato').where('isVerified', '==', true).limit(maxFetch).get(),
    db.collection('users').where('userType', '==', 'candidato').limit(maxFetch).get(),
    ...PREMIUM_CANDIDATE_QUERY_FILTERS.map(([field, value]) =>
      db.collection('users').where('userType', '==', 'candidato').where(field, '==', value).limit(maxFetch).get(),
    ),
  ]);

  const usersById = new Map();
  for (const snapshot of candidateSnapshots) {
    for (const doc of snapshot.docs) usersById.set(doc.id, doc);
  }

  const userDocs = Array.from(usersById.values());
  const userIds = userDocs.map((doc) => doc.id);
  const profileDocs = userIds.length
    ? await db.getAll(...userIds.map((uid) => db.collection('profiles').doc(uid)))
    : [];

  const profilesMap = new Map();
  for (const doc of profileDocs) {
    if (doc.exists) profilesMap.set(doc.id, doc.data() || {});
  }

  return userDocs
    .map((doc) => {
      const userData = doc.data() || {};
      const profileData = profilesMap.get(doc.id) || {};
      if (!canCandidateAppearInTalentPool(profileData)) return null;

      const allSkills = [
        ...normalizeStringList(userData.skills),
        ...normalizeStringList(profileData.skillsHard),
        ...normalizeStringList(profileData.digitalSkills),
      ];

      const visibility = buildCandidateVisibility(userData, profileData);
      const verified = visibility.verified;

      if (!verified) return null;

      return {
        id: doc.id,
        fullName: userData.fullName || userData.name || profileData.fullName || 'Sem nome',
        photoUrl: userData.photoUrl || userData.photo || profileData.photoUrl || '',
        location:
          profileData.city ||
          profileData.location ||
          userData.cidade ||
          userData.localizacao ||
          userData.location ||
          'Localização desconhecida',
        bio: canViewDetailedInfo ? userData.bio || userData.sobre || profileData.bio || '' : '',
        skills: canViewDetailedInfo ? allSkills : [],
        areasInteresse: normalizeStringList(userData.areasInteresse || userData.areas),
        objectiveArea: canViewDetailedInfo ? profileData.objectiveArea || userData.areasInteresse?.[0] || '' : '',
        experience: profileData.experience || userData.experiencia || '',
        verified: true,
        verificationTypes: visibility.verificationTypes,
        verificationType: visibility.verificationType,
        paidVerified: visibility.paidVerified,
        qualifiedVerified: visibility.qualifiedVerified,
        qualificationScore: visibility.qualificationScore,
        qualificationLabel: visibility.qualificationLabel,
        destaque: visibility.highlighted,
        profileComplete: visibility.isProfileComplete,
        completionScore: visibility.completionScore,
        visibilityScore: visibility.visibilityScore,
        createdAt: toIsoDateString(userData.createdAt),
        createdAtMillis: visibility.createdAtMillis || toMillis(userData.createdAt),
      };
    })
    .filter(Boolean)
    .sort(compareCandidatesByVisibility);
}

export function summarizeVerifiedCandidates(candidatos = []) {
  const areas = new Set();

  candidatos.forEach((candidato) => {
    if (Array.isArray(candidato.areasInteresse)) {
      candidato.areasInteresse.forEach((area) => {
        if (area) areas.add(area);
      });
    }

    if (candidato.objectiveArea) {
      areas.add(candidato.objectiveArea);
    }
  });

  return {
    totalCandidatos: candidatos.length,
    uniqueAreasCount: areas.size,
    featuredCandidatesCount: candidatos.filter((candidato) => candidato.destaque).length,
  };
}
