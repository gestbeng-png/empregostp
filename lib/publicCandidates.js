import { buildCandidateVisibility, compareCandidatesByVisibility, isCandidateVerified } from './candidateProfileInsights';

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

function normalizeCategoryLabel(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (!normalized) return 'Serviço';

  const labels = {
    formacao: 'Formação',
    consultoria: 'Consultoria',
    mentoria: 'Mentoria',
    workshop: 'Workshop',
    curso: 'Curso',
  };

  return labels[normalized] || String(category).trim();
}

function isActiveService(service) {
  const status = String(service.status || 'active').trim().toLowerCase();
  return !status || status === 'active' || status === 'published';
}

function serviceTargetsCandidates(service) {
  const audience = String(
    service.audience || service.targetAudience || service.userType || service.publico || ''
  )
    .trim()
    .toLowerCase();

  if (audience) {
    if (['empresa', 'empresas', 'company', 'companies', 'employer'].includes(audience)) {
      return false;
    }
    if (['all', 'candidato', 'candidatos', 'candidate', 'candidates'].includes(audience)) {
      return true;
    }
  }

  const haystack = [
    service.title,
    service.description,
    service.category,
    ...(service.features || []),
  ]
    .join(' ')
    .toLowerCase();

  const looksCompanyOnly =
    /(empresa|empresas|recrutamento|employer|company)/.test(haystack) &&
    !/(candidato|candidatos|carreira|cv|curriculo|portfolio|entrevista|freelancer|linkedin)/.test(haystack);

  return !looksCompanyOnly;
}

function mapServiceDoc(doc, source) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    title: String(data.title || data.name || '').trim(),
    description: String(data.description || data.summary || '').trim(),
    category: normalizeCategoryLabel(data.category || data.type || ''),
    status: String(data.status || 'active').trim().toLowerCase(),
    features: normalizeStringList(data.features),
    price: String(data.price || '').trim(),
    priceNote: String(data.priceNote || '').trim(),
    duration: String(data.duration || '').trim(),
    cta: String(data.cta || '').trim(),
    popular: Boolean(data.popular),
    color: String(data.color || '').trim(),
    audience: String(data.audience || data.targetAudience || '').trim(),
    createdAtMillis: toMillis(data.createdAt || data.updatedAt),
    source,
  };
}

export async function fetchCandidateServices(admin) {
  const db = admin.firestore();
  const [servicesSnapshot, resourceServicesSnapshot] = await Promise.all([
    db.collection('services').get(),
    db.collection('resources_services').get(),
  ]);

  const mappedServices = [
    ...servicesSnapshot.docs.map((doc) => mapServiceDoc(doc, 'services')),
    ...resourceServicesSnapshot.docs.map((doc) => mapServiceDoc(doc, 'resources_services')),
  ].filter((service) => {
    return service.title && service.description && isActiveService(service) && serviceTargetsCandidates(service);
  });

  const servicesByKey = new Map();
  for (const service of mappedServices) {
    const key = service.title.toLowerCase();
    const existing = servicesByKey.get(key);

    if (!existing) {
      servicesByKey.set(key, service);
      continue;
    }

    if (existing.source === 'resources_services' && service.source === 'services') {
      servicesByKey.set(key, service);
    }
  }

  return Array.from(servicesByKey.values()).sort((a, b) => {
    if (a.popular !== b.popular) return a.popular ? -1 : 1;
    if ((b.createdAtMillis || 0) !== (a.createdAtMillis || 0)) {
      return (b.createdAtMillis || 0) - (a.createdAtMillis || 0);
    }
    return a.title.localeCompare(b.title, 'pt');
  });
}

function serviceTargetsCompanies(service) {
  const audience = String(
    service.audience || service.targetAudience || service.userType || service.publico || ''
  )
    .trim()
    .toLowerCase();

  if (audience) {
    if (['candidato', 'candidatos', 'candidate', 'candidates'].includes(audience)) {
      return false;
    }
    if (['all', 'empresa', 'empresas', 'company', 'companies', 'employer'].includes(audience)) {
      return true;
    }
  }

  const haystack = [
    service.title,
    service.description,
    service.category,
    ...(service.features || []),
  ]
    .join(' ')
    .toLowerCase();

  const looksCandidateOnly =
    /(candidato|candidatos|carreira|curriculo|currículo|\bcv\b|portfolio|linkedin|certificado)/.test(haystack) &&
    !/(empresa|empresas|recrutamento|recrutador|company|employer|vaga|vagas|talento|talentos)/.test(haystack);

  return !looksCandidateOnly;
}

export async function fetchCompanyServices(admin) {
  const db = admin.firestore();
  const [servicesSnapshot, resourceServicesSnapshot] = await Promise.all([
    db.collection('services').get(),
    db.collection('resources_services').get(),
  ]);

  const mappedServices = [
    ...servicesSnapshot.docs.map((doc) => mapServiceDoc(doc, 'services')),
    ...resourceServicesSnapshot.docs.map((doc) => mapServiceDoc(doc, 'resources_services')),
  ].filter((service) => {
    return service.title && service.description && isActiveService(service) && serviceTargetsCompanies(service);
  });

  const servicesByKey = new Map();
  for (const service of mappedServices) {
    const key = service.title.toLowerCase();
    const existing = servicesByKey.get(key);

    if (!existing) {
      servicesByKey.set(key, service);
      continue;
    }

    if (existing.source === 'resources_services' && service.source === 'services') {
      servicesByKey.set(key, service);
    }
  }

  return Array.from(servicesByKey.values()).sort((a, b) => {
    if (a.popular !== b.popular) return a.popular ? -1 : 1;
    if ((b.createdAtMillis || 0) !== (a.createdAtMillis || 0)) {
      return (b.createdAtMillis || 0) - (a.createdAtMillis || 0);
    }
    return a.title.localeCompare(b.title, 'pt');
  });
}

export async function fetchVerifiedCandidates(admin, access = {}) {
  const db = admin.firestore();
  const maxFetch = Math.min(Math.max(Number(access.maxFetch) || 200, 1), 500);
  const canViewDetailedInfo = Boolean(access.canViewDetailedInfo);

  const [verifiedFlagSnap, verifiedStatusSnap, verifiedLegacySnap, verifiedLegacy2Snap] = await Promise.all([
    db.collection('users').where('userType', '==', 'candidato').where('verified', '==', true).limit(maxFetch).get(),
    db.collection('users').where('userType', '==', 'candidato').where('verificationStatus', '==', 'verified').limit(maxFetch).get(),
    db.collection('users').where('userType', '==', 'candidato').where('verificado', '==', true).limit(maxFetch).get(),
    db.collection('users').where('userType', '==', 'candidato').where('isVerified', '==', true).limit(maxFetch).get(),
  ]);

  const usersById = new Map();
  for (const doc of verifiedFlagSnap.docs) usersById.set(doc.id, doc);
  for (const doc of verifiedStatusSnap.docs) usersById.set(doc.id, doc);
  for (const doc of verifiedLegacySnap.docs) usersById.set(doc.id, doc);
  for (const doc of verifiedLegacy2Snap.docs) usersById.set(doc.id, doc);

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
      const allSkills = [
        ...normalizeStringList(userData.skills),
        ...normalizeStringList(profileData.skillsHard),
        ...normalizeStringList(profileData.digitalSkills),
      ];

      const verified = isCandidateVerified(userData, profileData);

      if (!verified) return null;

      const visibility = buildCandidateVisibility(userData, profileData);

      return {
        id: doc.id,
        fullName: userData.fullName || userData.name || profileData.fullName || 'Sem nome',
        photoUrl: userData.photoUrl || userData.photo || profileData.photoUrl || '',
        location:
          userData.cidade ||
          userData.localizacao ||
          profileData.location ||
          userData.location ||
          'Localização desconhecida',
        bio: canViewDetailedInfo ? userData.bio || userData.sobre || profileData.bio || '' : '',
        skills: canViewDetailedInfo ? allSkills : [],
        areasInteresse: normalizeStringList(userData.areasInteresse || userData.areas),
        objectiveArea: canViewDetailedInfo ? profileData.objectiveArea || userData.areasInteresse?.[0] || '' : '',
        experience: profileData.experience || userData.experiencia || '',
        verified: true,
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
