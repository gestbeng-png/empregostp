import { buildCandidateVisibility } from './candidateProfileInsights';
import { getCandidatePrivacy } from './candidatePrivacy';
import { PREMIUM_CANDIDATE_QUERY_FILTERS } from './candidatePlanFeatures';

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
 * A marca de verificado ficou gravada em vários campos ao longo do tempo
 * (`verified`, `verificado`, `isVerified`, `verificationStatus`), umas vezes
 * no documento `users` e outras só em `profiles`. Procura-se nos dois e a
 * decisão final é a mesma da página do candidato (`buildCandidateVisibility`):
 * antes a home só olhava para `users`, perdia quem estava verificado apenas
 * no perfil e mostrava quem tinha a verificação rejeitada — com um link que
 * dava 404.
 */
export async function fetchSpotlightCandidates(admin, { limite = 0 } = {}) {
  const db = admin.firestore();
  const candidatos = db
    .collection('users')
    .where('userType', '==', 'candidato');
  const perfis = db.collection('profiles');

  // Só igualdades simples, como antes: não pedem índices compostos novos.
  const porCampo = (query) => [
    query.where('verified', '==', true).get(),
    query.where('verificado', '==', true).get(),
    query.where('isVerified', '==', true).get(),
    query.where('verificationStatus', '==', 'verified').get(),
    query.where('verificationStatus', '==', 'approved').get(),
  ];
  const [userSnaps, profileSnaps] = await Promise.all([
    Promise.all([
      ...porCampo(candidatos),
      ...PREMIUM_CANDIDATE_QUERY_FILTERS.map(([field, value]) =>
        candidatos.where(field, '==', value).get(),
      ),
    ]),
    Promise.all(porCampo(perfis)),
  ]);

  const userPorId = new Map();
  for (const snap of userSnaps) {
    for (const doc of snap.docs) userPorId.set(doc.id, doc.data() || {});
  }
  const perfilPorId = new Map();
  for (const snap of profileSnaps) {
    for (const doc of snap.docs) perfilPorId.set(doc.id, doc.data() || {});
  }

  // Quem só tem a marca no perfil: falta o documento `users` (nome, foto e a
  // confirmação de que é candidato).
  const soNoPerfil = [...perfilPorId.keys()].filter((id) => !userPorId.has(id));
  if (soNoPerfil.length) {
    const users = await db.getAll(
      ...soNoPerfil.map((id) => db.collection('users').doc(id)),
    );
    users.forEach((doc) => {
      const data = doc.exists ? doc.data() || {} : null;
      if (data?.userType === 'candidato') userPorId.set(doc.id, data);
    });
  }

  // E o inverso: quem tem a marca em `users` ainda precisa do perfil, onde
  // estão a privacidade e a decisão da revisão.
  const semPerfil = [...userPorId.keys()].filter((id) => !perfilPorId.has(id));
  if (semPerfil.length) {
    const profiles = await db.getAll(...semPerfil.map((id) => perfis.doc(id)));
    profiles.forEach((doc) => {
      if (doc.exists) perfilPorId.set(doc.id, doc.data() || {});
    });
  }

  const lista = [...userPorId.entries()]
    .filter(
      ([id, userData]) =>
        buildCandidateVisibility(userData, perfilPorId.get(id) || {}).verified,
    )
    .map(([id, userData]) =>
      buildSpotlightCandidate(id, userData, perfilPorId.get(id) || {}),
    )
    .filter(Boolean)
    .sort(compareSpotlightCandidates);

  return limite > 0 ? lista.slice(0, limite) : lista;
}
