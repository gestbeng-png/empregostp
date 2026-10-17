import { getCandidatePrivacy } from './candidatePrivacy';

/**
 * Candidatos verificados prontos para o carrossel público.
 *
 * Estava tudo dentro do `getServerSideProps` da home. Passou para aqui quando a
 * página /empresas precisou do mesmo carrossel: a lista tem de ser idêntica nas
 * duas páginas, e a regra de privacidade não pode existir em duas cópias que
 * possam divergir.
 *
 * O que sai daqui já é seguro para uma página pública: perfis privados ficam de
 * fora e não vão contactos nem texto do currículo — só o que o cartão mostra.
 */

export function getInitials(value = '') {
  return (
    String(value)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'ES'
  );
}

export function formatCandidateExperience(userData = {}, profileData = {}) {
  const explicitValues = [
    profileData.experienceYears,
    profileData.yearsOfExperience,
    profileData.anosExperiencia,
    profileData.anosDeExperiencia,
    userData.experienceYears,
    userData.yearsOfExperience,
    userData.anosExperiencia,
    userData.anosDeExperiencia,
  ];

  for (const value of explicitValues) {
    if (value === null || value === undefined || value === '') continue;

    const normalized = String(value).trim();
    const numericMatch = normalized.match(/\d+(?:[.,]\d+)?/);
    const years = numericMatch
      ? Number.parseFloat(numericMatch[0].replace(',', '.'))
      : Number.NaN;

    if (!Number.isFinite(years) || years <= 0 || years > 60) continue;

    const roundedYears = Math.max(1, Math.round(years));
    const prefix = /mais de/i.test(normalized) ? 'Mais de ' : '';
    return `Anos de experiência: ${prefix}${roundedYears} ${
      roundedYears === 1 ? 'ano' : 'anos'
    }`;
  }

  const experienceEntries = [
    ...(Array.isArray(profileData.experience) ? profileData.experience : []),
    ...(Array.isArray(profileData.experiences) ? profileData.experiences : []),
    ...(Array.isArray(userData.experience) ? userData.experience : []),
    ...(Array.isArray(userData.experiences) ? userData.experiences : []),
  ];
  const currentYear = new Date().getFullYear();
  const yearsInPeriods = experienceEntries.flatMap((entry) => {
    const period = String(
      entry?.period || entry?.periodo || entry?.dateRange || '',
    );
    const years = (period.match(/(?:19|20)\d{2}/g) || [])
      .map(Number)
      .filter((year) => year >= 1950 && year <= currentYear);

    if (/atual|presente|current/i.test(period)) years.push(currentYear);
    return years;
  });

  if (yearsInPeriods.length >= 2) {
    const earliestYear = Math.min(...yearsInPeriods);
    const latestYear = Math.max(...yearsInPeriods);
    const years = Math.max(1, latestYear - earliestYear);
    return `Anos de experiência: ${years} ${years === 1 ? 'ano' : 'anos'}`;
  }

  return experienceEntries.length
    ? 'Experiência profissional registada'
    : 'Perfil profissional verificado';
}

/**
 * Monta o cartão a partir dos documentos crus. Devolve `null` quando o perfil
 * não pode aparecer publicamente.
 */
export function buildSpotlightCandidate(id, userData = {}, profileData = {}) {
  const privacy = getCandidatePrivacy(profileData);
  if (privacy.profileVisibility === 'private') return null;

  const fullName = String(
    userData.fullName ||
      userData.name ||
      profileData.fullName ||
      profileData.name ||
      'Candidato verificado',
  ).trim();

  const headline = String(
    userData.headline ||
      userData.profession ||
      profileData.headline ||
      profileData.profession ||
      profileData.objectiveArea ||
      'Profissional',
  ).trim();

  // F2.1/K1: sem destaque pago de candidatos; a ordem é só por recência.
  const destaque = false;

  const createdAtRaw = userData.createdAt || profileData.createdAt || null;

  return {
    id,
    fullName,
    headline,
    initials: getInitials(fullName),
    photoUrl:
      userData.photoUrl ||
      userData.photo ||
      profileData.photoUrl ||
      profileData.photo ||
      '',
    verified: true,
    experienceLabel: formatCandidateExperience(userData, profileData),
    profileVisibility: privacy.profileVisibility,
    destaque,
    createdAt: createdAtRaw?.toDate?.()?.toISOString?.() || null,
  };
}

/** Destacados primeiro, depois os mais recentes. */
export function compareSpotlightCandidates(a, b) {
  if (a.destaque !== b.destaque) return b.destaque ? 1 : -1;
  return (
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

/**
 * Lê os candidatos verificados do Firestore.
 *
 * São quatro consultas porque a marca de verificado ficou gravada em quatro
 * campos diferentes ao longo do tempo (`verified`, `verificado`, `isVerified` e
 * `verificationStatus`); o Map junta-as sem repetir ninguém.
 */
export async function fetchSpotlightCandidates(admin, { limite = 0 } = {}) {
  const db = admin.firestore();
  const candidatos = db
    .collection('users')
    .where('userType', '==', 'candidato');

  const [
    verifiedFlagSnap,
    verifiedLegacySnap,
    verifiedLegacy2Snap,
    verifiedStatusSnap,
    approvedStatusSnap,
  ] = await Promise.all([
    candidatos.where('verified', '==', true).get(),
    candidatos.where('verificado', '==', true).get(),
    candidatos.where('isVerified', '==', true).get(),
    candidatos.where('verificationStatus', '==', 'verified').get(),
    candidatos.where('verificationStatus', '==', 'approved').get(),
  ]);

  const porId = new Map();
  for (const snap of [
    verifiedFlagSnap,
    verifiedLegacySnap,
    verifiedLegacy2Snap,
    verifiedStatusSnap,
    approvedStatusSnap,
  ]) {
    for (const doc of snap.docs) porId.set(doc.id, doc);
  }

  const docs = Array.from(porId.values());
  if (!docs.length) return [];

  const perfis = await db.getAll(
    ...docs.map((doc) => db.collection('profiles').doc(doc.id)),
  );
  const perfilPorId = new Map();
  perfis.forEach((doc) => {
    if (doc.exists) perfilPorId.set(doc.id, doc.data() || {});
  });

  const lista = docs
    .map((doc) =>
      buildSpotlightCandidate(
        doc.id,
        doc.data() || {},
        perfilPorId.get(doc.id) || {},
      ),
    )
    .filter(Boolean)
    .sort(compareSpotlightCandidates);

  return limite > 0 ? lista.slice(0, limite) : lista;
}
