import { admin } from '../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import {
  buildPendingDeletion,
  evaluateDeletionRequest,
  getPendingDeletion,
} from '../../../lib/accountDeletion';
import { accountDeletionRequestedEmail } from '../../../lib/accountDeletionEmails';
import { collectCandidateExport } from '../../../lib/candidateDataExport';
import { sendEmail } from '../../../lib/email';
import { logServerError, logServerWarning } from '../../../lib/serverLog';
import { consumeRateLimit } from '../../../infrastructure/firebase/marketplace/consumeRateLimit';

/**
 * Direitos do titular (H5) para candidatos.
 *
 *   GET  /api/me/privacy              estado do pedido de eliminação
 *   GET  /api/me/privacy?export=1     ficheiro JSON com os dados pessoais
 *   POST { action: 'request_deletion', confirmation: 'ELIMINAR' }
 *   POST { action: 'cancel_deletion' }
 */

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://empregostp.com'
).replace(/\/+$/, '');

function rateLimitSecret() {
  return (
    process.env.RATE_LIMIT_HASH_SECRET ||
    `empregostp:${process.env.FIREBASE_PROJECT_ID || admin.app().options.projectId || 'local'}`
  );
}

async function allow(action, uid) {
  const result = await consumeRateLimit(
    admin.firestore(),
    action,
    { userId: uid },
    rateLimitSecret(),
  );
  return result.allowed;
}

function deletionView(userData) {
  const pending = getPendingDeletion(userData);
  return pending
    ? {
        status: 'PENDING',
        requestedAt: new Date(pending.requestedAtMs).toISOString(),
        executeAfter: new Date(pending.executeAfterMs).toISOString(),
      }
    : null;
}

async function audit(uid, action) {
  await admin.firestore().collection('auditLogs').add({
    actorId: uid,
    actorType: 'USER',
    action,
    resourceType: 'users',
    resourceId: uid,
    metadata: {},
    at: admin.firestore.Timestamp.now(),
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authResult = await requireActiveApiUser(req, res);
  if (!authResult) return;
  const { uid, userData, decodedToken } = authResult;

  if (userData.userType !== 'candidato') {
    return res.status(403).json({
      error:
        'Esta área está disponível para contas de candidato. Para contas de empresa, contacte o suporte.',
      code: 'NOT_CANDIDATE',
    });
  }

  try {
    if (req.method === 'GET') {
      if (req.query?.export !== '1') {
        return res.status(200).json({ deletion: deletionView(userData) });
      }
      if (!(await allow('personal_data_export', uid))) {
        return res.status(429).json({
          error:
            'Já exportou os seus dados várias vezes esta semana. Tente novamente mais tarde.',
          code: 'RATE_LIMITED',
        });
      }
      const data = await collectCandidateExport(admin, uid);
      await audit(uid, 'personal_data_exported');
      const day = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="empregostp-dados-${day}.json"`,
      );
      return res.status(200).send(JSON.stringify(data, null, 2));
    }

    const action = req.body?.action;
    if (action !== 'request_deletion' && action !== 'cancel_deletion') {
      return res.status(400).json({ error: 'Pedido inválido.' });
    }
    if (!(await allow('account_deletion', uid))) {
      return res.status(429).json({
        error: 'Demasiados pedidos. Tente novamente amanhã.',
        code: 'RATE_LIMITED',
      });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const profileRef = db.collection('profiles').doc(uid);
    const nowMs = Date.now();

    if (action === 'cancel_deletion') {
      const fresh = (await userRef.get()).data() || {};
      if (!getPendingDeletion(fresh)) {
        return res.status(200).json({ deletion: null });
      }
      const batch = db.batch();
      batch.update(userRef, {
        deletion: admin.firestore.FieldValue.delete(),
      });
      batch.set(
        profileRef,
        { pendingDeletion: admin.firestore.FieldValue.delete() },
        { merge: true },
      );
      await batch.commit();
      await audit(uid, 'account_deletion_cancelled');
      return res.status(200).json({ deletion: null });
    }

    const evaluation = evaluateDeletionRequest({
      userData,
      authTimeSeconds: decodedToken.auth_time,
      confirmation: req.body?.confirmation,
      nowMs,
    });
    if (!evaluation.ok) {
      const status = evaluation.code === 'ALREADY_PENDING' ? 409 : 400;
      return res
        .status(status)
        .json({ error: evaluation.message, code: evaluation.code });
    }

    const deletion = buildPendingDeletion(nowMs);
    const batch = db.batch();
    batch.update(userRef, { deletion });
    // O perfil sai já de pesquisas e páginas públicas (getCandidatePrivacy).
    batch.set(profileRef, { pendingDeletion: true }, { merge: true });
    await batch.commit();
    await audit(uid, 'account_deletion_requested');

    // O pedido já está gravado: uma falha de email não o desfaz (secção 61).
    if (userData.email) {
      try {
        const email = accountDeletionRequestedEmail({
          executeAfterMs: deletion.executeAfterMs,
          site: SITE_URL,
        });
        await sendEmail({ to: userData.email, ...email });
      } catch (error) {
        logServerWarning('account_deletion.email_failed', error);
      }
    }

    return res.status(200).json({ deletion: deletionView({ deletion }) });
  } catch (error) {
    logServerError('me_privacy.request_failed', error);
    return res.status(500).json({
      error:
        'Não foi possível concluir o pedido. Tente novamente em instantes.',
    });
  }
}
