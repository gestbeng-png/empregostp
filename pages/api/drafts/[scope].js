import { admin } from '../../../lib/firebaseAdmin';
import {
  DEFAULT_DRAFT_TTL_MS,
  FORM_DRAFT_VERSION,
  sanitizeDraftValue,
} from '../../../lib/formDraft';
import { logServerError } from '../../../lib/serverLog';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';

const ALLOWED_SCOPES = new Set([
  'candidate-profile',
  'company-profile',
  'cv-generator',
  'company-job',
  'job-application',
  'admin-job',
  'admin-blog',
  'admin-news',
  'admin-resource',
  'company-hr-service',
  'admin-hr-response',
]);

const RESOURCE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const MAX_DRAFT_BYTES = 350_000;

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function serializeTimestamp(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function resolveDraftTarget(req) {
  const scope = String(firstQueryValue(req.query.scope) || '').trim();
  const resourceId = String(
    firstQueryValue(req.query.resourceId) || 'default',
  ).trim();

  if (!ALLOWED_SCOPES.has(scope)) return null;
  if (!RESOURCE_ID_PATTERN.test(resourceId)) return null;

  return {
    scope,
    resourceId,
    documentId: `${scope}__${resourceId}`,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');

  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const target = resolveDraftTarget(req);
  if (!target) {
    return res
      .status(400)
      .json({ error: 'Identificador de rascunho inválido.' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      invalidTokenMessage: 'Sessão inválida.',
      missingTokenMessage: 'Sessão necessária.',
    });
    if (!authResult) return;
    const { uid, userRef } = authResult;

    const draftRef = userRef.collection('formDrafts').doc(target.documentId);

    if (req.method === 'DELETE') {
      await draftRef.delete();
      return res.status(200).json({ deleted: true });
    }

    if (req.method === 'GET') {
      const snapshot = await draftRef.get();
      if (!snapshot.exists) return res.status(200).json({ draft: null });

      const stored = snapshot.data() || {};
      const expiresAtMs = stored.expiresAt?.toMillis
        ? stored.expiresAt.toMillis()
        : Date.parse(String(stored.expiresAt || ''));

      if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
        await draftRef.delete();
        return res.status(200).json({ draft: null });
      }

      return res.status(200).json({
        draft: {
          version: stored.version || FORM_DRAFT_VERSION,
          data: stored.data || null,
          savedAt: serializeTimestamp(stored.updatedAt),
          expiresAt: serializeTimestamp(stored.expiresAt),
        },
      });
    }

    const version = Number(req.body?.version || FORM_DRAFT_VERSION);
    if (version !== FORM_DRAFT_VERSION) {
      return res.status(400).json({ error: 'Versão de rascunho inválida.' });
    }

    const sanitizedData = sanitizeDraftValue(req.body?.data);
    if (
      sanitizedData === null ||
      sanitizedData === undefined ||
      typeof sanitizedData !== 'object'
    ) {
      return res.status(400).json({ error: 'Conteúdo de rascunho inválido.' });
    }

    const serialized = JSON.stringify(sanitizedData);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_DRAFT_BYTES) {
      return res.status(413).json({
        error: 'O rascunho ultrapassa o tamanho máximo permitido.',
      });
    }

    const now = Date.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now + DEFAULT_DRAFT_TTL_MS,
    );

    await draftRef.set(
      {
        ownerId: uid,
        scope: target.scope,
        resourceId: target.resourceId,
        version: FORM_DRAFT_VERSION,
        data: sanitizedData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
      },
      { merge: false },
    );

    return res.status(200).json({
      saved: true,
      savedAt: new Date(now).toISOString(),
      expiresAt: expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    logServerError('form_draft.request_failed', error, {
      scope: target.scope,
      method: req.method,
    });
    return res
      .status(500)
      .json({ error: 'Não foi possível guardar o rascunho.' });
  }
}
