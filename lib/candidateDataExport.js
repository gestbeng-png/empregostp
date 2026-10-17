// Exportação dos dados pessoais do candidato (H5, «Exportar dados»).
//
// JSON imediato com perfil, conta, candidaturas (só a parte do candidato —
// notas internas da empresa vivem noutras coleções e não entram), guardados,
// alertas, notificações, verificações, pedidos de plano e consentimentos. Os
// ficheiros vão como links assinados de 48 h.
import { candidateStoragePrefixes } from './accountDeletion';

export const EXPORT_FILE_LINK_TTL_MS = 48 * 60 * 60 * 1000;
export const EXPORT_SCHEMA_VERSION = 1;

const SECRET_KEY_PATTERN = /token|secret|password|hash|fcm|vapid/i;

function isTimestampLike(value) {
  return (
    value &&
    typeof value === 'object' &&
    (typeof value.toDate === 'function' ||
      (typeof value._seconds === 'number' &&
        typeof value._nanoseconds === 'number'))
  );
}

/** Datas em ISO e nada que funcione como credencial. */
export function toExportValue(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (isTimestampLike(value)) {
    const date =
      typeof value.toDate === 'function'
        ? value.toDate()
        : new Date(value._seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (Array.isArray(value)) return value.map(toExportValue);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEY_PATTERN.test(key))
      .map(([key, item]) => [key, toExportValue(item)]),
  );
}

function docsToExport(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...toExportValue(doc.data()),
  }));
}

export function buildCandidateExport({
  uid,
  nowMs,
  user,
  profile,
  applications,
  savedJobs,
  jobAlerts,
  notifications,
  verifications,
  subscriptionRequests,
  consents,
  files,
}) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    accountId: uid,
    notes: [
      'Inclui os dados que o EmpregoSTP guarda sobre si enquanto candidato.',
      'As candidaturas mostram o que enviou; as notas internas das empresas não fazem parte dos seus dados.',
      'Os links dos ficheiros expiram 48 horas depois da exportação.',
    ],
    account: toExportValue(user || {}),
    profile: toExportValue(profile || {}),
    applications,
    savedJobs,
    jobAlerts,
    notifications,
    verifications,
    subscriptionRequests,
    consents,
    files,
  };
}

async function listOwnFiles(bucket, uid, nowMs) {
  const expires = nowMs + EXPORT_FILE_LINK_TTL_MS;
  const files = [];
  for (const prefix of candidateStoragePrefixes(uid)) {
    const [found] = await bucket.getFiles({ prefix });
    for (const file of found) {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires,
        version: 'v4',
      });
      files.push({
        path: file.name,
        size: Number(file.metadata?.size) || null,
        contentType: file.metadata?.contentType || null,
        url,
        expiresAt: new Date(expires).toISOString(),
      });
    }
  }
  return files;
}

export async function collectCandidateExport(
  adminApp,
  uid,
  nowMs = Date.now(),
) {
  const db = adminApp.firestore();
  const [userDoc, profileDoc] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('profiles').doc(uid).get(),
  ]);
  const user = userDoc.exists ? userDoc.data() : {};
  const email = String(user.email || '')
    .trim()
    .toLowerCase();

  const [
    applications,
    savedJobs,
    notifications,
    verifications,
    subscriptionRequests,
    consents,
    jobAlerts,
  ] = await Promise.all([
    db.collection('applications').where('candidateId', '==', uid).get(),
    db.collection('savedJobs').where('candidateId', '==', uid).get(),
    db.collection('notifications').where('userId', '==', uid).get(),
    db.collection('verifications').where('uid', '==', uid).get(),
    db.collection('subscription-requests').where('userId', '==', uid).get(),
    db.collection('consents').where('userId', '==', uid).get(),
    email
      ? db.collection('jobAlerts').where('email', '==', email).get()
      : Promise.resolve({ docs: [] }),
  ]);

  const files = await listOwnFiles(adminApp.storage().bucket(), uid, nowMs);

  return buildCandidateExport({
    uid,
    nowMs,
    user,
    profile: profileDoc.exists ? profileDoc.data() : {},
    applications: docsToExport(applications),
    savedJobs: docsToExport(savedJobs),
    jobAlerts: docsToExport(jobAlerts),
    notifications: docsToExport(notifications),
    verifications: docsToExport(verifications),
    subscriptionRequests: docsToExport(subscriptionRequests),
    consents: docsToExport(consents),
    files,
  });
}
