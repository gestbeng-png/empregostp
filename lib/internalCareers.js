import { createHash } from 'crypto';
import { admin } from './firebaseAdmin';
import { isJobPubliclyVisible } from './jobExpiration';
import { projectPublicJob } from './publicJob';
import { logServerWarning } from './serverLog';
import { organizationVerificationOf } from '../domain/jobs/submission';

export const CAREERS_CONSENT_VERSION = 'careers-v1';
export const MAX_CV_BYTES = 2 * 1024 * 1024;

// Deployment configuration is the trust anchor, never a company display name.
export function getInternalCareersConfiguration() {
  const organizationId = process.env.EMPREGOSTP_ORGANIZATION_ID?.trim() || '';
  const configured = Boolean(organizationId && organizationId !== '.' &&
    organizationId !== '..' && !/[\/\u0000-\u001f]/.test(organizationId) &&
    Buffer.byteLength(organizationId) <= 1500);
  return { configured, organizationId: configured ? organizationId : null };
}

function serialize(value) {
  if (value == null) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serialize(item)]),
  );
  return value;
}

export async function getInternalOpportunities() {
  const { configured, organizationId } = getInternalCareersConfiguration();
  if (!configured) {
    logServerWarning('careers.organization_not_configured');
    return [];
  }
  const db = admin.firestore();
  const organization = await db.collection('organizations').doc(organizationId).get();
  const legacy = !organization.exists;
  const identity = legacy ? await db.collection('users').doc(organizationId).get() : organization;
  const identityData = identity.data() || {};
  if (!identity.exists || (legacy && (identityData.userType !== 'empresa' ||
      (identityData.organizationId && identityData.organizationId !== organizationId))) ||
      ['disabled', 'inactive', 'suspended', 'deleted'].includes(String(identityData.status || '').toLowerCase()) ||
      !['ORGANIZATION_VERIFIED', 'TRUSTED_PARTNER'].includes(organizationVerificationOf(identityData))) {
    logServerWarning('careers.organization_not_verified');
    return [];
  }
  const jobs = db.collection('jobs');
  const snapshots = [await jobs.where(legacy ? 'companyId' : 'organizationId', '==', organizationId).get()];
  const unique = new Map();
  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const job = { ...doc.data(), id: doc.id };
      if ((legacy ? (job.organizationId ?? job.companyId) : job.organizationId) !== organizationId ||
          !isJobPubliclyVisible(job)) continue;
      unique.set(doc.id, serialize(projectPublicJob(job)));
    }
  }
  return [...unique.values()];
}

export class CareersValidationError extends Error {
  constructor(field) {
    const messages = {
      name: 'Indique um nome entre 2 e 100 caracteres.',
      email: 'Introduza um endereço de email válido.',
      area: 'Indique uma área de interesse entre 2 e 120 caracteres.',
      message: 'Escreva uma mensagem entre 10 e 4000 caracteres.',
      consent: 'Aceite o consentimento de tratamento de dados apresentado.',
      phone: 'Introduza um número de telefone válido.',
      portfolio: 'Introduza um endereço HTTP ou HTTPS válido para o portefólio.',
      cv: 'Anexe um PDF válido com tamanho máximo de 2 MiB.',
      'cv.name': 'Indique um nome de ficheiro PDF válido, até 120 caracteres.',
      body: 'Envie os dados da candidatura em formato JSON.',
    };
    super(messages[field] || 'Verifique os dados da candidatura.');
    this.field = field;
  }
}

function invalid(field) {
  throw new CareersValidationError(field);
}

function text(value, field, min, max) {
  if (typeof value !== 'string') invalid(field);
  const normalized = value.trim().replace(/\r\n/g, '\n');
  if (normalized.length < min || normalized.length > max ||
      /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) invalid(field);
  return normalized;
}

export function validateInternalApplication(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const name = text(body.name, 'name', 2, 100);
  const email = text(body.email, 'email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('email');
  const area = text(body.area, 'area', 2, 120);
  const message = text(body.message, 'message', 10, 4000);
  if (body.consent !== true || body.consentVersion !== CAREERS_CONSENT_VERSION) invalid('consent');
  const phone = body.phone == null || body.phone === '' ? null : text(body.phone, 'phone', 5, 40);
  if (phone && !/^[+\d() .-]+$/.test(phone)) invalid('phone');
  const portfolio = body.portfolio == null || body.portfolio === '' ? null : text(body.portfolio, 'portfolio', 1, 2048);
  if (portfolio) {
    try {
      const url = new URL(portfolio);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) invalid('portfolio');
    } catch { invalid('portfolio'); }
  }
  let cv = null;
  if (body.cv != null) {
    const fileName = text(body.cv.name, 'cv.name', 5, 120);
    if (!/\.pdf$/i.test(fileName) || /[\/\\]/.test(fileName) || body.cv.contentType !== 'application/pdf') invalid('cv');
    const encoded = body.cv.base64;
    if (typeof encoded !== 'string' || !encoded.length ||
        encoded.length > Math.ceil(MAX_CV_BYTES / 3) * 4 ||
        encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) invalid('cv');
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length > MAX_CV_BYTES || buffer.toString('base64') !== encoded ||
        !/^%PDF-1\.[0-7]|^%PDF-2\.0/.test(buffer.subarray(0, 8).toString('ascii')) ||
        !/%%EOF\s*$/.test(buffer.subarray(-1024).toString('ascii'))) invalid('cv');
    cv = { fileName, buffer };
  }
  return { name, email, area, message, phone, portfolio,
    consent: true, consentVersion: CAREERS_CONSENT_VERSION, cv };
}

export function applicationEmailPartition(email) {
  return createHash('sha256').update(email).digest('hex');
}

export async function persistInternalApplication(application) {
  const reference = admin.firestore().collection('internalCareerApplications').doc();
  const { cv, ...fields } = application;
  let file;
  try {
    let attachment = null;
    if (cv) {
      const storagePath = `internal-careers/${reference.id}/cv.pdf`;
      file = admin.storage().bucket().file(storagePath);
      await file.save(cv.buffer, {
        resumable: false,
        metadata: { contentType: 'application/pdf', cacheControl: 'private, no-store',
          contentDisposition: 'attachment; filename="cv.pdf"' },
      });
      attachment = { storagePath, name: cv.fileName, contentType: 'application/pdf', size: cv.buffer.length };
    }
    await reference.create({ ...fields, cv: attachment, status: 'new', source: 'careers',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      consentAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) {
    // Best effort compensation: never leave an intentionally public attachment.
    if (file) {
      try { await file.delete({ ignoreNotFound: true }); }
      catch (cleanupError) { logServerWarning('careers.cv_cleanup_failed', cleanupError); }
    }
    throw error;
  }
}
