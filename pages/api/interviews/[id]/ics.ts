import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import { getInterviewService } from '@/infrastructure/firebase/interviews/createInterviewService';

/** GET — convite de calendário (E6), para o candidato ou a organização. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end();
    return;
  }
  const auth = await authenticateApiUser(req, res);
  if (!auth) return;
  const result = await getInterviewService().calendar(
    auth.uid,
    String(req.query.id ?? ''),
  );
  if (!result.ok) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="entrevista-empregostp.ics"',
  );
  res.status(200).send(result.value.ics);
}
