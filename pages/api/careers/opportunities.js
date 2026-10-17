import { getInternalOpportunities } from '../../../lib/internalCareers';
import { logServerError } from '../../../lib/serverLog';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  try {
    return res.status(200).json({ opportunities: await getInternalOpportunities() });
  } catch (error) {
    logServerError('careers.opportunities_failed', error);
    return res.status(503).json({ error: 'Não foi possível consultar as oportunidades.' });
  }
}
