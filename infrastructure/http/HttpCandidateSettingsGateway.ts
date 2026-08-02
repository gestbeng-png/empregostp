import { getAuth } from 'firebase/auth';

import { candidateSettingsResponseSchema } from '@/application/candidate-settings/contracts/candidateSettingsSchema';
import type { CandidateSettingsGateway } from '@/application/candidate-settings/ports/CandidateSettingsGateway';
import type { CandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import { pt } from '@/shared/i18n/pt';

interface ErrorPayload {
  error?: unknown;
}

export class HttpCandidateSettingsGateway implements CandidateSettingsGateway {
  public async get(): Promise<CandidateSettings> {
    return this.request('GET');
  }

  public async save(settings: CandidateSettings): Promise<CandidateSettings> {
    return this.request('POST', { settings });
  }

  private async request(
    method: 'GET' | 'POST',
    body?: { settings: CandidateSettings },
  ): Promise<CandidateSettings> {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) {
      throw new Error(pt.candidateSettings.api.sessionExpired);
    }

    const response = await fetch('/api/candidate/settings', {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(this.readError(payload));
    }

    const result = candidateSettingsResponseSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(pt.candidateSettings.api.unexpected);
    }

    return result.data.settings;
  }

  private readError(payload: unknown): string {
    if (typeof payload !== 'object' || payload === null) {
      return pt.candidateSettings.api.unexpected;
    }

    const error = (payload as ErrorPayload).error;
    return typeof error === 'string'
      ? error
      : pt.candidateSettings.api.unexpected;
  }
}
