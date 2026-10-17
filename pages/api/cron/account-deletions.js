import { admin } from '../../../lib/firebaseAdmin';
import { executeDueAccountDeletions } from '../../../lib/accountDeletionExecutor';
import { logServerError } from '../../../lib/serverLog';
import { matchesCronSecret } from '../../../presentation/outbox/createOutboxCronHandler';

/**
 * H5 — executa os pedidos de eliminação de conta cujo prazo de 7 dias já
 * passou. Vercel Cron diário (vercel.json). Resposta só com contagens.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  }
  if (!matchesCronSecret(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ code: 'UNAUTHORIZED' });
  }

  try {
    const result = await executeDueAccountDeletions(admin);
    return res
      .status(result.failed > 0 ? 500 : 200)
      .json({ status: result.failed > 0 ? 'partial' : 'processed', ...result });
  } catch (error) {
    logServerError('cron.account_deletions_failed', error);
    return res.status(500).json({ status: 'failed' });
  }
}
