import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { applicationEmailPartition, CareersValidationError, persistInternalApplication,
  validateInternalApplication } from '../../../lib/internalCareers';
import { logServerError } from '../../../lib/serverLog';

export const config = { api: { bodyParser: { sizeLimit: '3mb' } } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  try {
    if (req.headers.origin) {
      let expectedOrigin;
      try {
        expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
      } catch {
        return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
      }
      if (req.headers.origin !== expectedOrigin) {
        return res.status(403).json({ error: 'Origem não permitida.' });
      }
    }
    if (!(await enforceApiRateLimit(req, res, {
      scope: 'careers_application_ip', limit: 5, windowMs: 3600000, failClosed: true,
    }))) return;
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return res.status(415).json({ error: 'Envie JSON.' });
    }
    const application = validateInternalApplication(req.body);
    if (!(await enforceApiRateLimit(req, res, {
      scope: 'careers_application_email', partition: applicationEmailPartition(application.email),
      limit: 3, windowMs: 86400000, failClosed: true,
    }))) return;
    await persistInternalApplication(application);
    return res.status(201).json({ message: 'Candidatura recebida. Obrigado pelo seu interesse.' });
  } catch (error) {
    if (error instanceof CareersValidationError) return res.status(400).json({
      error: error.message, field: error.field, fieldErrors: { [error.field]: error.message },
    });
    logServerError('careers.application_failed', error);
    return res.status(503).json({ error: 'Não foi possível guardar a candidatura. Tente novamente.' });
  }
}
