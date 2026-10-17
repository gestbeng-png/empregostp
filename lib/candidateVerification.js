const VERIFICATION_TYPES = [
  {
    id: 'identity',
    label: 'Identidade',
    description: 'Confirma a identidade civil e os contactos base do candidato.',
  },
  {
    id: 'certificates',
    label: 'Certificados',
    description: 'Valida certificados, cursos e comprovativos anexados ao perfil.',
  },
  {
    id: 'academic',
    label: 'Académica',
    description: 'Analisa formação académica e comprovativos de estudos.',
  },
  {
    id: 'experience',
    label: 'Experiência',
    description: 'Verifica histórico profissional, CV e comprovativos de experiência.',
  },
  {
    id: 'competencies',
    label: 'Competências',
    description: 'Reforça skills, portefólio e sinais de competências reais do perfil.',
  },
];

export const VERIFICATION_TYPE_CONFIG = Object.fromEntries(
  VERIFICATION_TYPES.map((entry) => [entry.id, entry])
);

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function sanitizeText(value = '') {
  return String(value || '').trim();
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, currentValue]) => [key, sanitizeVerificationValue(currentValue)])
      .filter(([, currentValue]) => currentValue !== undefined)
  );
}

function sanitizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeVerificationValue(item))
    .filter((item) => item !== undefined);
}

function sanitizeVerificationValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return sanitizeArray(value);
  if (typeof value === 'object') return sanitizeObject(value);
  if (typeof value === 'string') return value.trim();
  return value;
}

function uniqueByKey(items = [], keyBuilder) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyBuilder(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeExperienceEntries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      company: sanitizeText(entry?.company),
      role: sanitizeText(entry?.role),
      period: sanitizeText(entry?.period),
      description: sanitizeText(entry?.description),
    }))
    .filter((entry) => entry.company || entry.role || entry.period || entry.description);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeText(item)).filter(Boolean);
  }
  if (!value) return [];
  return String(value)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDocumentEntry(document, fallbackLabel, source = 'submission') {
  if (!document) return null;
  if (typeof document === 'string') {
    return {
      label: fallbackLabel,
      url: document,
      type: 'file',
      source,
    };
  }

  if (typeof document !== 'object') return null;
  const url = sanitizeText(document.url || document.href || document.link || document.downloadURL);
  const text = sanitizeText(document.text || document.value || document.note || document.description);

  if (url) {
    return {
      label: sanitizeText(document.label || document.fileName || fallbackLabel) || fallbackLabel,
      url,
      type: sanitizeText(document.type || 'file') || 'file',
      source: sanitizeText(document.source || source) || source,
      fileName: sanitizeText(document.fileName || ''),
    };
  }

  if (text) {
    return {
      label: sanitizeText(document.label || fallbackLabel) || fallbackLabel,
      text,
      type: 'note',
      source: sanitizeText(document.source || source) || source,
    };
  }

  return null;
}

function normalizeDocumentList(value, fallbackLabel, source = 'submission') {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDocumentEntry(item, fallbackLabel, source))
      .filter(Boolean);
  }

  const single = normalizeDocumentEntry(value, fallbackLabel, source);
  return single ? [single] : [];
}

function createChecklistItem(id, label, completed, required = false, hint = '') {
  return {
    id,
    label,
    completed: Boolean(completed),
    required: Boolean(required),
    hint: sanitizeText(hint),
  };
}

function createEvidenceNote(label, text, source = 'profile') {
  if (!hasValue(text)) return null;
  return {
    id: slugify(`${label}-${text}`),
    label,
    text: sanitizeText(text),
    type: 'note',
    source,
  };
}

function createEvidenceLink(label, url, source = 'profile') {
  if (!hasValue(url)) return null;
  return {
    id: slugify(`${label}-${url}`),
    label,
    url: sanitizeText(url),
    type: 'link',
    source,
  };
}

function createEvidenceFile(label, url, source = 'profile', fileName = '') {
  if (!hasValue(url)) return null;
  return {
    id: slugify(`${label}-${url}`),
    label,
    url: sanitizeText(url),
    type: 'file',
    source,
    fileName: sanitizeText(fileName),
  };
}

function uniqueEvidenceItems(items = []) {
  return uniqueByKey(
    items.filter(Boolean),
    (item) => `${item.type}:${item.url || item.text || ''}:${item.label || ''}:${item.source || ''}`
  );
}

function buildProfileSnapshot(userData = {}, profileData = {}) {
  const experience = normalizeExperienceEntries(profileData.experience || userData.experience);
  const skillsHard = normalizeStringArray(profileData.skillsHard || userData.skills);
  const skillsSoft = normalizeStringArray(profileData.skillsSoft);
  const digitalSkills = normalizeStringArray(profileData.digitalSkills);
  const certificateFiles = Array.isArray(profileData.certificateFiles)
    ? profileData.certificateFiles.map((url) => sanitizeText(url)).filter(Boolean)
    : [];

  return {
    fullName: sanitizeText(userData.fullName || userData.name || profileData.fullName),
    email: sanitizeText(userData.email || profileData.email),
    phone: sanitizeText(userData.phone || profileData.phone),
    headline: sanitizeText(profileData.headline || profileData.profession || userData.headline || userData.profession),
    location: sanitizeText(profileData.city || profileData.location || userData.location || userData.localizacao),
    linkedin: sanitizeText(profileData.linkedin),
    website: sanitizeText(profileData.website),
    objectiveArea: sanitizeText(profileData.objectiveArea || userData.objectiveArea),
    objectiveType: sanitizeText(profileData.objectiveType || userData.objectiveType),
    bio: sanitizeText(profileData.bio || userData.bio || userData.sobre),
    education: sanitizeText(profileData.education || userData.education),
    certifications: sanitizeText(profileData.certifications || userData.certifications),
    certificateFiles,
    skillsHard,
    skillsSoft,
    digitalSkills,
    experience,
    cvUrl: sanitizeText(profileData.cvUrl || userData.cvUrl),
    cvName: sanitizeText(profileData.cvName || userData.cvName),
    verificationStatus: sanitizeText(userData.verificationStatus || profileData.verificationStatus || 'unverified'),
  };
}

function inferRequestedTypes(documents = {}, profileSnapshot = {}) {
  const requested = new Set();
  const explicit = Array.isArray(documents.requestedTypes)
    ? documents.requestedTypes.map((item) => sanitizeText(item))
    : [];

  explicit.forEach((type) => {
    if (VERIFICATION_TYPE_CONFIG[type]) requested.add(type);
  });

  if (
    documents.contact ||
    documents.idDocument ||
    documents.selfieDocument
  ) {
    requested.add('identity');
  }

  if (
    documents.certificateDocuments ||
    documents.certificates ||
    documents.certificateFiles ||
    hasValue(documents.certificationsText)
  ) {
    requested.add('certificates');
  }

  if (
    documents.academicDocument ||
    hasValue(documents.academicInstitution) ||
    hasValue(documents.academicCourse) ||
    hasValue(documents.educationSummary)
  ) {
    requested.add('academic');
  }

  if (
    documents.employmentProof ||
    documents.cvDocument ||
    hasValue(documents.experienceSummary) ||
    hasValue(documents.employerName) ||
    hasValue(documents.employerRole)
  ) {
    requested.add('experience');
  }

  if (
    documents.competencyDocument ||
    hasValue(documents.portfolioUrl) ||
    hasValue(documents.competencyNotes) ||
    hasValue(documents.skillsSummary)
  ) {
    requested.add('competencies');
  }

  if (!requested.size) {
    if (hasValue(profileSnapshot.email) || hasValue(profileSnapshot.phone)) requested.add('identity');
    if (profileSnapshot.certificateFiles?.length || hasValue(profileSnapshot.certifications)) requested.add('certificates');
    if (hasValue(profileSnapshot.education)) requested.add('academic');
    if (profileSnapshot.experience?.length || hasValue(profileSnapshot.cvUrl)) requested.add('experience');
    if (
      (profileSnapshot.skillsHard?.length || 0) >= 3 ||
      hasValue(profileSnapshot.linkedin) ||
      hasValue(profileSnapshot.website)
    ) {
      requested.add('competencies');
    }
  }

  return Array.from(requested).filter((type) => VERIFICATION_TYPE_CONFIG[type]);
}

function buildIdentityItem({ requested, previousItem, documents, profileSnapshot, nowIso }) {
  const contact = sanitizeObject(documents.contact || {});
  const email = sanitizeText(contact.email || profileSnapshot.email);
  const phone = sanitizeText(contact.phone || profileSnapshot.phone);
  const idDocument = normalizeDocumentEntry(documents.idDocument, 'Documento de identidade', 'submission');
  const selfieDocument = normalizeDocumentEntry(documents.selfieDocument, 'Selfie com documento', 'submission');

  const checklist = [
    createChecklistItem('email', 'Email confirmado', hasValue(email), true, 'Informe um email válido para contacto.'),
    createChecklistItem('phone', 'Telefone confirmado', hasValue(phone), true, 'Informe um telefone ativo.'),
    createChecklistItem('id-document', 'Documento de identidade anexado', Boolean(idDocument?.url), true, 'Anexe BI ou passaporte legível.'),
    createChecklistItem('selfie-document', 'Selfie de verificação anexada', Boolean(selfieDocument?.url), true, 'Anexe selfie segurando o documento.'),
  ];

  const evidence = uniqueEvidenceItems([
    createEvidenceNote('Email confirmado', email, contact.email ? 'submission' : 'profile'),
    createEvidenceNote('Telefone confirmado', phone, contact.phone ? 'submission' : 'profile'),
    idDocument
      ? createEvidenceFile(idDocument.label || 'Documento de identidade', idDocument.url, idDocument.source, idDocument.fileName)
      : null,
    selfieDocument
      ? createEvidenceFile(selfieDocument.label || 'Selfie com documento', selfieDocument.url, selfieDocument.source, selfieDocument.fileName)
      : null,
  ]);

  return finalizeVerificationItem('identity', requested, previousItem, checklist, evidence, nowIso);
}

function buildCertificatesItem({ requested, previousItem, documents, profileSnapshot, nowIso }) {
  const supportingFiles = uniqueEvidenceItems([
    ...normalizeDocumentList(documents.certificateDocuments, 'Certificado', 'submission').map((item) =>
      item.url ? createEvidenceFile(item.label, item.url, item.source, item.fileName) : createEvidenceNote(item.label, item.text, item.source)
    ),
    ...normalizeDocumentList(documents.certificateFiles, 'Certificado', 'submission').map((item) =>
      item.url ? createEvidenceFile(item.label, item.url, item.source, item.fileName) : null
    ),
    ...profileSnapshot.certificateFiles.map((url, index) => createEvidenceFile(`Certificado ${index + 1}`, url, 'profile')),
  ]);

  const certificationsText = sanitizeText(documents.certificationsText || documents.certifications || profileSnapshot.certifications);
  const checklist = [
    createChecklistItem('certificates-text', 'Descrição dos certificados', hasValue(certificationsText), false, 'Liste cursos, entidades ou certificados relevantes.'),
    createChecklistItem('certificates-files', 'Comprovativos anexados', supportingFiles.length > 0, true, 'Anexe certificados ou comprovativos em PDF/imagem.'),
  ];

  const evidence = uniqueEvidenceItems([
    createEvidenceNote('Resumo de certificações', certificationsText, documents.certificationsText || documents.certifications ? 'submission' : 'profile'),
    ...supportingFiles,
  ]);

  return finalizeVerificationItem('certificates', requested, previousItem, checklist, evidence, nowIso);
}

function buildAcademicItem({ requested, previousItem, documents, profileSnapshot, nowIso }) {
  const academicDocument = normalizeDocumentEntry(documents.academicDocument, 'Comprovativo académico', 'submission');
  const educationSummary = sanitizeText(
    documents.educationSummary ||
      [documents.academicCourse, documents.academicInstitution].filter(Boolean).join(' • ') ||
      profileSnapshot.education
  );

  const checklist = [
    createChecklistItem('education-summary', 'Formação académica informada', hasValue(educationSummary), true, 'Informe curso, grau ou formação relevante.'),
    createChecklistItem('academic-document', 'Comprovativo académico anexado', Boolean(academicDocument?.url), false, 'Anexe diploma, declaração ou certificado académico.'),
  ];

  const evidence = uniqueEvidenceItems([
    createEvidenceNote('Resumo académico', educationSummary, documents.educationSummary || documents.academicCourse || documents.academicInstitution ? 'submission' : 'profile'),
    academicDocument
      ? createEvidenceFile(academicDocument.label || 'Comprovativo académico', academicDocument.url, academicDocument.source, academicDocument.fileName)
      : null,
  ]);

  return finalizeVerificationItem('academic', requested, previousItem, checklist, evidence, nowIso);
}

function buildExperienceItem({ requested, previousItem, documents, profileSnapshot, nowIso }) {
  const employmentProof = normalizeDocumentEntry(documents.employmentProof, 'Comprovativo de experiência', 'submission');
  const cvDocument = normalizeDocumentEntry(documents.cvDocument, 'Currículo atualizado', 'submission');
  const fallbackCv = profileSnapshot.cvUrl
    ? createEvidenceFile(profileSnapshot.cvName || 'CV atual', profileSnapshot.cvUrl, 'profile', profileSnapshot.cvName)
    : null;
  const experienceSummary = sanitizeText(documents.experienceSummary);
  const profileExperienceSummary = profileSnapshot.experience
    .slice(0, 4)
    .map((entry) => [entry.role, entry.company, entry.period].filter(Boolean).join(' • '))
    .filter(Boolean)
    .join('\n');

  const checklist = [
    createChecklistItem(
      'experience-history',
      'Histórico profissional preenchido',
      profileSnapshot.experience.length > 0 || hasValue(experienceSummary) || hasValue(profileExperienceSummary),
      true,
      'Inclua pelo menos uma experiência ou resumo profissional.'
    ),
    createChecklistItem(
      'experience-proof',
      'CV ou comprovativo anexado',
      Boolean(employmentProof?.url || cvDocument?.url || fallbackCv?.url),
      true,
      'Anexe CV atualizado ou comprovativo de trabalho.'
    ),
  ];

  const evidence = uniqueEvidenceItems([
    createEvidenceNote('Resumo de experiência', experienceSummary || profileExperienceSummary, experienceSummary ? 'submission' : 'profile'),
    employmentProof
      ? createEvidenceFile(employmentProof.label || 'Comprovativo de experiência', employmentProof.url, employmentProof.source, employmentProof.fileName)
      : null,
    cvDocument
      ? createEvidenceFile(cvDocument.label || 'Currículo atualizado', cvDocument.url, cvDocument.source, cvDocument.fileName)
      : null,
    fallbackCv,
  ]);

  return finalizeVerificationItem('experience', requested, previousItem, checklist, evidence, nowIso);
}

function buildCompetenciesItem({ requested, previousItem, documents, profileSnapshot, nowIso }) {
  const competencyDocument = normalizeDocumentEntry(documents.competencyDocument, 'Comprovativo de competências', 'submission');
  const portfolioUrl = sanitizeText(documents.portfolioUrl || profileSnapshot.website);
  const linkedinUrl = sanitizeText(documents.linkedin || profileSnapshot.linkedin);
  const competenciesNotes = sanitizeText(documents.competencyNotes || documents.skillsSummary);
  const totalSkills =
    (profileSnapshot.skillsHard?.length || 0) +
    (profileSnapshot.skillsSoft?.length || 0) +
    (profileSnapshot.digitalSkills?.length || 0);

  const skillSummary = [
    ...(profileSnapshot.skillsHard || []),
    ...(profileSnapshot.digitalSkills || []),
    ...(profileSnapshot.skillsSoft || []),
  ].slice(0, 8).join(', ');

  const checklist = [
    createChecklistItem('skills-summary', 'Competências listadas no perfil', totalSkills >= 3 || hasValue(competenciesNotes), true, 'Adicione pelo menos 3 competências ou um resumo objetivo.'),
    createChecklistItem('portfolio-link', 'Link de suporte ou comprovativo', Boolean(portfolioUrl || linkedinUrl || competencyDocument?.url), false, 'Adicione portefólio, LinkedIn ou documento de apoio.'),
  ];

  const evidence = uniqueEvidenceItems([
    createEvidenceNote('Resumo de competências', competenciesNotes || skillSummary, competenciesNotes ? 'submission' : 'profile'),
    createEvidenceLink('Portefólio', portfolioUrl, documents.portfolioUrl ? 'submission' : 'profile'),
    createEvidenceLink('LinkedIn', linkedinUrl, documents.linkedin ? 'submission' : 'profile'),
    competencyDocument
      ? createEvidenceFile(competencyDocument.label || 'Comprovativo de competências', competencyDocument.url, competencyDocument.source, competencyDocument.fileName)
      : null,
  ]);

  return finalizeVerificationItem('competencies', requested, previousItem, checklist, evidence, nowIso);
}

function finalizeVerificationItem(type, requested, previousItem, checklist, evidence, nowIso) {
  const baseConfig = VERIFICATION_TYPE_CONFIG[type];
  const previousStatus = sanitizeText(previousItem?.status || 'not_requested');
  let status = 'not_requested';

  if (requested) {
    status = previousStatus === 'approved' ? 'approved' : 'pending';
  } else if (['approved', 'pending', 'rejected'].includes(previousStatus)) {
    status = previousStatus;
  }

  return {
    type,
    label: baseConfig.label,
    description: baseConfig.description,
    requested: Boolean(requested || ['approved', 'pending', 'rejected'].includes(previousStatus)),
    status,
    checklist,
    evidence,
    completedChecklistCount: checklist.filter((item) => item.completed).length,
    totalChecklistCount: checklist.length,
    evidenceCount: evidence.length,
    submittedAt: requested ? nowIso : previousItem?.submittedAt || null,
    reviewReason: previousItem?.reviewReason || '',
    reviewedAt: previousItem?.reviewedAt || null,
    reviewedBy: previousItem?.reviewedBy || null,
  };
}

function getRequestedTypeSet(documents, profileSnapshot, previousItems = {}) {
  const inferred = inferRequestedTypes(documents, profileSnapshot);
  const requestedSet = new Set(inferred);

  Object.entries(previousItems || {}).forEach(([type, item]) => {
    if (item?.status === 'approved' || item?.status === 'pending' || item?.status === 'rejected') {
      requestedSet.add(type);
    }
  });

  return requestedSet;
}

export function buildVerificationRecord(input = {}) {
  const {
    uid,
    documents = {},
    userData = {},
    profileData = {},
    previousRecord = null,
    now = new Date().toISOString(),
  } = input;

  const safeDocuments = sanitizeVerificationValue(documents) || {};
  const previousItems = sanitizeVerificationValue(previousRecord?.verificationItems || {}) || {};
  const profileSnapshot = buildProfileSnapshot(userData, profileData);
  const requestedTypeSet = getRequestedTypeSet(safeDocuments, profileSnapshot, previousItems);

  const verificationItems = {
    identity: buildIdentityItem({
      requested: requestedTypeSet.has('identity'),
      previousItem: previousItems.identity,
      documents: safeDocuments,
      profileSnapshot,
      nowIso: now,
    }),
    certificates: buildCertificatesItem({
      requested: requestedTypeSet.has('certificates'),
      previousItem: previousItems.certificates,
      documents: safeDocuments,
      profileSnapshot,
      nowIso: now,
    }),
    academic: buildAcademicItem({
      requested: requestedTypeSet.has('academic'),
      previousItem: previousItems.academic,
      documents: safeDocuments,
      profileSnapshot,
      nowIso: now,
    }),
    experience: buildExperienceItem({
      requested: requestedTypeSet.has('experience'),
      previousItem: previousItems.experience,
      documents: safeDocuments,
      profileSnapshot,
      nowIso: now,
    }),
    competencies: buildCompetenciesItem({
      requested: requestedTypeSet.has('competencies'),
      previousItem: previousItems.competencies,
      documents: safeDocuments,
      profileSnapshot,
      nowIso: now,
    }),
  };

  const summary = summarizeVerificationItems(verificationItems, now);
  return {
    uid,
    documents: safeDocuments,
    requestedTypes: summary.requestedTypes,
    verificationItems,
    summary,
    profileSnapshot,
    status: summary.status,
  };
}

export function summarizeVerificationItems(verificationItems = {}, now = new Date().toISOString()) {
  const items = Object.values(verificationItems || {}).filter(Boolean);
  const requestedItems = items.filter((item) => item.requested);
  const approvedItems = requestedItems.filter((item) => item.status === 'approved');
  const pendingItems = requestedItems.filter((item) => item.status === 'pending');
  const rejectedItems = requestedItems.filter((item) => item.status === 'rejected');
  const identityItem = verificationItems.identity || {};
  const publicVerified = identityItem.status === 'approved';

  let status = 'draft';
  if (pendingItems.length > 0) status = 'pending';
  else if (approvedItems.length > 0 && rejectedItems.length > 0) status = 'partial';
  else if (approvedItems.length > 0) status = 'approved';
  else if (rejectedItems.length > 0) status = 'rejected';

  const progressPercent = requestedItems.length
    ? Math.round((approvedItems.length / requestedItems.length) * 100)
    : 0;

  return {
    status,
    requestedCount: requestedItems.length,
    approvedCount: approvedItems.length,
    pendingCount: pendingItems.length,
    rejectedCount: rejectedItems.length,
    progressPercent,
    publicVerified,
    identityStatus: identityItem.status || 'not_requested',
    lastSubmittedAt: now,
    requestedTypes: requestedItems.map((item) => item.type),
    types: Object.fromEntries(
      items.map((item) => [
        item.type,
        {
          status: item.status,
          requested: item.requested,
          completedChecklistCount: item.completedChecklistCount,
          totalChecklistCount: item.totalChecklistCount,
          evidenceCount: item.evidenceCount,
          label: item.label,
        },
      ])
    ),
  };
}

export function validateVerificationRecord(record = {}) {
  const verificationItems = record.verificationItems || {};
  const issues = [];

  const validators = {
    identity: (item) => item.checklist.filter((entry) => entry.required && !entry.completed).length === 0,
    certificates: (item) => item.evidenceCount > 0 || item.checklist.some((entry) => entry.completed),
    academic: (item) => item.checklist.some((entry) => entry.completed),
    experience: (item) => item.checklist.filter((entry) => entry.required && !entry.completed).length === 0,
    competencies: (item) => item.checklist.some((entry) => entry.completed),
  };

  Object.entries(verificationItems).forEach(([type, item]) => {
    if (!item?.requested || item.status === 'approved') return;
    const validator = validators[type];
    if (!validator || validator(item)) return;
    issues.push({
      type,
      label: item.label || VERIFICATION_TYPE_CONFIG[type]?.label || type,
      reason: `Complete os requisitos mínimos de ${item.label || type} antes de enviar.`,
    });
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function derivePublicVerificationState(record = {}) {
  const items = record.verificationItems || {};
  const summary = record.summary || summarizeVerificationItems(items);
  const identity = items.identity || {};

  if (identity.status === 'approved') {
    return {
      verificationStatus: 'verified',
      verified: true,
      rejectionReason: '',
    };
  }

  if (identity.status === 'pending' || summary.pendingCount > 0) {
    return {
      verificationStatus: 'pending',
      verified: false,
      rejectionReason: '',
    };
  }

  if (identity.status === 'rejected') {
    return {
      verificationStatus: 'rejected',
      verified: false,
      rejectionReason: identity.reviewReason || '',
    };
  }

  return {
    verificationStatus: 'unverified',
    verified: false,
    rejectionReason: '',
  };
}

export function buildVerificationProfileSummary(record = {}) {
  const items = record.verificationItems || {};
  const summary = record.summary || summarizeVerificationItems(items);
  return {
    requestedCount: summary.requestedCount || 0,
    approvedCount: summary.approvedCount || 0,
    pendingCount: summary.pendingCount || 0,
    rejectedCount: summary.rejectedCount || 0,
    progressPercent: summary.progressPercent || 0,
    publicVerified: Boolean(summary.publicVerified),
    identityStatus: summary.identityStatus || 'not_requested',
    lastSubmittedAt: summary.lastSubmittedAt || null,
    types: summary.types || {},
  };
}

export function reviewVerificationRecord(record = {}, input = {}) {
  const { action, verificationType = null, reviewerId = '', reason = '', now = new Date().toISOString() } = input;
  const nextRecord = sanitizeVerificationValue(record) || {};
  const verificationItems = sanitizeVerificationValue(nextRecord.verificationItems || {}) || {};

  // `revoke` desfaz uma aprovação: actua sobre tipos já aprovados e deixa-os
  // rejeitados, para que o candidato possa voltar a submeter.
  const sourceStatus = action === 'revoke' ? 'approved' : 'pending';
  const targetTypes = verificationType
    ? [verificationType]
    : Object.keys(verificationItems).filter((type) => verificationItems[type]?.status === sourceStatus);

  targetTypes.forEach((type) => {
    const currentItem = verificationItems[type];
    if (!currentItem) return;
    verificationItems[type] = {
      ...currentItem,
      requested: true,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewReason: sanitizeText(reason),
      reviewedAt: now,
      reviewedBy: reviewerId,
      ...(action === 'revoke' ? { revokedAt: now, revokedBy: reviewerId } : {}),
    };
  });

  const summary = summarizeVerificationItems(verificationItems, nextRecord.summary?.lastSubmittedAt || now);

  return {
    ...nextRecord,
    verificationItems,
    summary,
    status: summary.status,
  };
}

export function serializeVerificationTimestamps(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((item) => serializeVerificationTimestamps(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, serializeVerificationTimestamps(currentValue)])
    );
  }
  return value;
}
