import { createHash } from 'node:crypto';

export const MAX_PAYMENT_PROOF_FILE_SIZE = 10 * 1024 * 1024;

const BASE64_PATTERN =
  /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const SUPPORTED_CONTENT_TYPES = Object.freeze({
  'application/pdf': {
    contentType: 'application/pdf',
    extension: 'pdf',
  },
  'image/jpeg': { contentType: 'image/jpeg', extension: 'jpg' },
  'image/jpg': { contentType: 'image/jpeg', extension: 'jpg' },
  'image/png': { contentType: 'image/png', extension: 'png' },
});

function normalizeContentType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveSupportedType(value) {
  return SUPPORTED_CONTENT_TYPES[normalizeContentType(value)] || null;
}

function detectContentType(buffer) {
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  ) {
    return 'application/pdf';
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return 'image/png';
  }

  return null;
}

export function parsePaymentProofDataUrl({
  fileBase64 = '',
  contentType = '',
  maxFileSize = MAX_PAYMENT_PROOF_FILE_SIZE,
} = {}) {
  const dataUrl = typeof fileBase64 === 'string' ? fileBase64.trim() : '';
  const matches = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
  if (!matches) {
    throw new Error('Formato do comprovativo inválido');
  }

  const encoded = matches[2];
  if (!encoded || !BASE64_PATTERN.test(encoded)) {
    throw new Error('Formato do comprovativo inválido');
  }

  const effectiveMaxSize =
    Number.isFinite(maxFileSize) && maxFileSize > 0
      ? maxFileSize
      : MAX_PAYMENT_PROOF_FILE_SIZE;
  const maxEncodedLength = Math.ceil(effectiveMaxSize / 3) * 4;
  if (encoded.length > maxEncodedLength) {
    throw new Error('O comprovativo deve ter no máximo 10MB.');
  }

  const dataUrlType = resolveSupportedType(matches[1]);
  const declaredType = contentType
    ? resolveSupportedType(contentType)
    : dataUrlType;
  if (!dataUrlType || !declaredType) {
    throw new Error('Formato não suportado. Envie PDF, JPG ou PNG.');
  }
  if (dataUrlType.contentType !== declaredType.contentType) {
    throw new Error('O tipo do comprovativo não corresponde ao ficheiro.');
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (
    buffer.length === 0 ||
    buffer.toString('base64') !== encoded ||
    buffer.length > effectiveMaxSize
  ) {
    if (buffer.length > effectiveMaxSize) {
      throw new Error('O comprovativo deve ter no máximo 10MB.');
    }
    throw new Error('Ficheiro inválido');
  }

  const detectedContentType = detectContentType(buffer);
  if (detectedContentType !== dataUrlType.contentType) {
    throw new Error('O tipo do comprovativo não corresponde ao ficheiro.');
  }

  return {
    buffer,
    contentType: detectedContentType,
    extension: dataUrlType.extension,
  };
}

// Impressão digital do conteúdo (não do nome): dois envios do mesmo ficheiro
// com nomes diferentes dão o mesmo valor.
export function hashPaymentProof(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function createPaymentProofFileName(
  value,
  extension,
  timestamp = Date.now(),
) {
  const sanitized = String(value || '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.[^.]*$/, '')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 120);
  const baseName = sanitized || `comprovativo-${timestamp}`;
  return `${baseName}.${extension}`;
}
