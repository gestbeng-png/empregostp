import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { logServerError } from '../../../lib/serverLog';

// A autorização do dashboard usa o Bearer atual do browser, não um cookie
// que possa pertencer a uma sessão anterior. Nunca aceita uid/tipo do pedido.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    const account = await requireActiveApiUser(req, res);
    if (!account) return;
    const accountType = account.userData.userType;
    if (!['admin', 'empresa', 'candidato'].includes(accountType)) {
      return res.status(403).json({ error: 'Tipo de conta inválido.' });
    }
    return res.status(200).json({ uid: account.uid, accountType });
  } catch (error) {
    logServerError('auth.account_failed', error);
    return res.status(500).json({ error: 'Não foi possível validar a conta.' });
  }
}
