import type { NextApiRequest, NextApiResponse } from 'next';

import { candidateSettingsRequestSchema } from '@/application/candidate-settings/contracts/candidateSettingsSchema';
import { ApplicationError } from '@/domain/shared/errors';
import { createServerContainer } from '@/infrastructure/container/serverContainer';
import { verifyCandidateRequest } from '@/infrastructure/firebase/auth/verifyCandidateRequest';
import { pt } from '@/shared/i18n/pt';

interface ErrorResponse {
  error: string;
}

interface SettingsResponse {
  settings: Awaited<
    ReturnType<
      ReturnType<
        typeof createServerContainer
      >['getCandidateSettings']['execute']
    >
  >;
}

type ApiResponse = ErrorResponse | SettingsResponse;

function statusForError(error: ApplicationError): number {
  switch (error.code) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'candidate_not_found':
      return 404;
    case 'invalid_request':
      return 400;
    case 'unexpected':
      return 500;
  }
}

function messageForError(error: ApplicationError): string {
  switch (error.code) {
    case 'unauthorized':
      return pt.candidateSettings.api.sessionExpired;
    case 'forbidden':
      return pt.candidateSettings.api.candidateOnly;
    case 'candidate_not_found':
      return pt.candidateSettings.api.notFound;
    case 'invalid_request':
      return pt.candidateSettings.api.invalidPreferences;
    case 'unexpected':
      return pt.candidateSettings.api.unexpected;
  }
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<ApiResponse>,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', ['GET', 'POST']);
    response
      .status(405)
      .json({ error: pt.candidateSettings.api.methodNotAllowed });
    return;
  }

  try {
    const userId = await verifyCandidateRequest(request);
    const container = createServerContainer();

    if (request.method === 'GET') {
      const settings = await container.getCandidateSettings.execute(userId);
      response.status(200).json({ settings });
      return;
    }

    const requestBody: unknown = request.body;
    const parsedBody = candidateSettingsRequestSchema.safeParse(requestBody);
    if (!parsedBody.success) {
      throw new ApplicationError(
        'invalid_request',
        pt.candidateSettings.api.invalidPreferences,
        { cause: parsedBody.error },
      );
    }

    const settings = await container.saveCandidateSettings.execute(
      userId,
      parsedBody.data.settings,
    );
    response.status(200).json({ settings });
  } catch (error) {
    if (error instanceof ApplicationError) {
      response
        .status(statusForError(error))
        .json({ error: messageForError(error) });
      return;
    }

    console.error('Falha ao processar as preferências do candidato.', error);
    response.status(500).json({ error: pt.candidateSettings.api.unexpected });
  }
}
