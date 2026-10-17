import nookies from 'nookies';

import { admin } from '../../../lib/firebaseAdmin';
import { isUserAccountActive } from '../../../lib/userStatus';
import { logServerError, logServerWarning } from '../../../lib/serverLog';

const COOKIE_NAME = 'token';

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

function clearSessionCookie(req, res) {
  nookies.destroy({ req, res }, COOKIE_NAME, cookieOptions(-1));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'DELETE') {
    let revoked = false;
    const authHeader = req.headers.authorization;

    try {
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim();
        const decodedToken = await admin.auth().verifyIdToken(token);
        await admin.auth().revokeRefreshTokens(decodedToken.uid);
        revoked = true;
      }
    } catch (error) {
      // A limpeza do cookie é obrigatória mesmo quando Firebase está
      // indisponível ou o token já foi revogado/expirou.
      logServerWarning('auth_session.revoke_failed', error);
    } finally {
      clearSessionCookie(req, res);
    }

    return res.status(200).json({ success: true, revoked });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    clearSessionCookie(req, res);
    return res
      .status(401)
      .json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists) {
      clearSessionCookie(req, res);
      return res.status(404).json({
        code: 'USER_PROFILE_NOT_FOUND',
        error: 'Utilizador não encontrado. Conclua o seu registo.',
      });
    }

    if (!isUserAccountActive(userDoc.data())) {
      clearSessionCookie(req, res);
      return res.status(403).json({
        code: 'ACCOUNT_BLOCKED',
        error: 'Esta conta está suspensa ou inativa.',
      });
    }

    const secondsUntilExpiry =
      Number(decodedToken.exp) - Math.floor(Date.now() / 1000);
    const maxAge = Math.max(
      1,
      Math.min(60 * 60, secondsUntilExpiry || 60 * 60),
    );
    nookies.set({ req, res }, COOKIE_NAME, token, cookieOptions(maxAge));
    return res.status(200).json({ success: true });
  } catch (error) {
    clearSessionCookie(req, res);
    logServerError('auth_session.create_failed', error);
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}
