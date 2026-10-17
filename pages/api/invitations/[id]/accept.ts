import type { NextApiRequest, NextApiResponse } from 'next';

import {
  authenticateWithEmail,
  getTeamService,
} from '@/infrastructure/firebase/team/createTeamService';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';

/** POST — aceitar convite com o email verificado igual ao convidado. */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
    });
    return;
  }
  const user = await authenticateWithEmail(req, res);
  if (!user) return;
  const result = await getTeamService().accept(
    user,
    String(req.query.id ?? ''),
    req.body?.token,
  );
  if (!result.ok) {
    const status =
      { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_TRANSITION: 410 }[
        result.error.code as string
      ] ?? 400;
    res.status(status).json({ error: result.error });
    return;
  }
  res.status(200).json(result.value);
}

export default recruitmentApi(handler);
