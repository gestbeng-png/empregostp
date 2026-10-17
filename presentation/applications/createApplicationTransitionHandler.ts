import type { NextApiRequest, NextApiResponse } from 'next';

import type { TransitionReceipt } from '@/application/marketplace/ports';
import type { Result } from '@/domain/shared/Result';
import { logEvent } from '@/infrastructure/observability/logger';

export interface ApplicationTransitionDeps {
  authenticate(
    req: NextApiRequest,
    res: NextApiResponse,
  ): Promise<{ uid: string } | null>;
  transition(input: {
    actorUserId: string;
    applicationId: string;
    to: string;
    expectedVersion: number;
    idempotencyKey: string;
    reason?: string;
    closedReason?: string;
    candidateVisibleNote?: string;
  }): Promise<Result<TransitionReceipt>>;
}

const STATUS: Readonly<Record<string, number>> = {
  FEATURE_DISABLED: 404,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  TRANSITION_FORBIDDEN: 403,
  VERSION_CONFLICT: 409,
  INVALID_TRANSITION: 422,
  TRANSITION_GUARD_FAILED: 422,
  IDEMPOTENCY_CONFLICT: 422,
  LEGACY_STATUS_UNMAPPED: 422,
  INVALID_INPUT: 400,
};

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** POST /api/applications/[id]/transition — formato de erro único (D16). */
export function createApplicationTransitionHandler(
  deps: ApplicationTransitionDeps,
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Método não permitido.',
        },
      });
      return;
    }
    const auth = await deps.authenticate(req, res);
    if (!auth) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const header = req.headers['idempotency-key'];
    const idempotencyKey = String(
      (Array.isArray(header) ? header[0] : header) ?? '',
    ).trim();
    const applicationId = String(req.query.id ?? '');
    if (
      typeof body.to !== 'string' ||
      !Number.isSafeInteger(body.expectedVersion) ||
      !idempotencyKey
    ) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'O pedido contém dados inválidos.',
        },
      });
      return;
    }
    try {
      const result = await deps.transition({
        actorUserId: auth.uid,
        applicationId,
        to: body.to,
        expectedVersion: body.expectedVersion as number,
        idempotencyKey,
        reason: optionalString(body.reason),
        closedReason: optionalString(body.closedReason),
        candidateVisibleNote: optionalString(body.candidateVisibleNote),
      });
      if (!result.ok) {
        res
          .status(STATUS[result.error.code] ?? 400)
          .json({ error: result.error });
        return;
      }
      res.status(200).json(result.value);
    } catch (error) {
      logEvent(
        'error',
        'application_transition_failed',
        {
          route: '/api/applications/[id]/transition',
          errorCode: 'TRANSITION_FAILED',
        },
        error,
      );
      res.status(500).json({
        error: {
          code: 'INTERNAL',
          message: 'Não foi possível atualizar a candidatura. Tente novamente.',
        },
      });
    }
  };
}
