import type { NextApiRequest, NextApiResponse } from 'next';

import { isRecruitmentWorkspaceEnabled } from '@/lib/recruitmentAvailability';

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

/** ADR-019 — APIs de empresa/equipa: 404 (formato D16) enquanto a área está retirada. */
export function recruitmentApi(handler: Handler) {
  return (req: NextApiRequest, res: NextApiResponse): unknown => {
    if (isRecruitmentWorkspaceEnabled()) return handler(req, res);
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Esta funcionalidade não está disponível.',
      },
    });
    return undefined;
  };
}
