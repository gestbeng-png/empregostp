import type { NextApiRequest, NextApiResponse } from 'next';

import { matchesCronSecret } from '@/presentation/outbox/createOutboxCronHandler';

/** Read-only provider validation inside the deployment; never exports secrets or sends email. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }
  if (!matchesCronSecret(req.headers.authorization, process.env.CRON_SECRET)) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }
  const key = process.env.BREVO_API_KEY?.trim();
  const from = process.env.EMAIL_FROM_ADDRESS?.trim().toLowerCase();
  if (!key || !from) {
    res
      .status(503)
      .json({ status: 'not_ready', code: 'EMAIL_CONFIGURATION_MISSING' });
    return;
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/senders', {
      headers: { 'api-key': key },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    const ready =
      response.ok &&
      Array.isArray(data.senders) &&
      data.senders.some(
        (sender: { email?: string; active?: boolean }) =>
          sender.email?.toLowerCase() === from && sender.active === true,
      );
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      email: { providerStatus: response.status, senderVerified: ready },
    });
  } catch {
    res
      .status(503)
      .json({ status: 'not_ready', code: 'EMAIL_PROVIDER_UNAVAILABLE' });
  }
}
