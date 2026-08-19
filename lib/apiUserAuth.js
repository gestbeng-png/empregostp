import { admin } from './firebaseAdmin';
import { isUserAccountActive } from './userStatus';

function getBearerToken(req) {
  const header = String(req?.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function rejectRequest(res, status, message, { code, responseMode }) {
  if (responseMode === 'text') {
    res.status(status).end(message);
    return;
  }

  res.status(status).json({
    error: message,
    ...(code ? { code } : {}),
  });
}

/**
 * Autenticação central para APIs com dados de conta.
 *
 * Verifica revogação no Firebase, carrega exatamente uma vez users/{uid} e
 * fecha o acesso a contas administrativamente bloqueadas. Devolve `null`
 * depois de responder ao cliente, permitindo um `if (!authResult) return` nas
 * rotas sem alterar a sua lógica de negócio.
 */
export async function requireActiveApiUser(
  req,
  res,
  {
    adminApp = admin,
    blockedMessage = 'Esta conta está suspensa ou inativa.',
    invalidTokenMessage = 'Token inválido ou expirado',
    missingTokenMessage = 'Token de autenticação não fornecido',
    missingUserMessage = 'Utilizador não encontrado',
    missingUserStatus = 404,
    responseMode = 'json',
  } = {},
) {
  const token = getBearerToken(req);
  if (!token) {
    rejectRequest(res, 401, missingTokenMessage, { responseMode });
    return null;
  }

  let decodedToken;
  try {
    decodedToken = await adminApp.auth().verifyIdToken(token, true);
  } catch {
    rejectRequest(res, 401, invalidTokenMessage, { responseMode });
    return null;
  }

  const uid = String(decodedToken?.uid || '').trim();
  if (!uid) {
    rejectRequest(res, 401, invalidTokenMessage, { responseMode });
    return null;
  }

  const userRef = adminApp.firestore().collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    rejectRequest(res, missingUserStatus, missingUserMessage, { responseMode });
    return null;
  }

  const userData = userDoc.data() || {};
  if (!isUserAccountActive(userData)) {
    rejectRequest(res, 403, blockedMessage, {
      code: 'ACCOUNT_BLOCKED',
      responseMode,
    });
    return null;
  }

  return {
    decodedToken,
    token,
    uid,
    userData,
    userDoc,
    userRef,
  };
}
