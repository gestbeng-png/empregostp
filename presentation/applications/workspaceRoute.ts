import type { NextApiRequest, NextApiResponse } from 'next';

import type { Result } from '@/domain/shared/Result';
import { logEvent } from '@/infrastructure/observability/logger';

const STATUS: Readonly<Record<string, number>> = {
  NOT_FOUND: 404,
  FEATURE_DISABLED: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

/** Rota autenticada: um método, `private, no-store`, erros D16. */
export function workspaceRoute<T>(
  method: 'GET' | 'POST' | 'PATCH',
  authenticate: (
    req: NextApiRequest,
    res: NextApiResponse,
  ) => Promise<{ uid: string } | null>,
  run: (
    uid: string,
    applicationId: string,
    body: Record<string, unknown>,
  ) => Promise<Result<T>>,
  successStatus = method === 'POST' ? 201 : 200,
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== method) {
      res.setHeader('Allow', method);
      res.status(405).json({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Método não permitido.',
        },
      });
      return;
    }
    const auth = await authenticate(req, res);
    if (!auth) return;
    try {
      const result = await run(
        auth.uid,
        String(req.query.id ?? ''),
        (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
          string,
          unknown
        >,
      );
      if (!result.ok) {
        res
          .status(STATUS[result.error.code] ?? 400)
          .json({ error: result.error });
        return;
      }
      res.status(successStatus).json(result.value);
    } catch (error) {
      logEvent(
        'error',
        'application_workspace_failed',
        { route: '/api/applications/[id]', errorCode: 'WORKSPACE_FAILED' },
        error,
      );
      res.status(500).json({
        error: {
          code: 'INTERNAL',
          message: 'Não foi possível concluir o pedido. Tente novamente.',
        },
      });
    }
  };
}
