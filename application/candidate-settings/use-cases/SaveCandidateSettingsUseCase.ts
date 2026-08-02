import { candidateSettingsSchema } from '@/application/candidate-settings/contracts/candidateSettingsSchema';
import type { CandidateSettingsRepository } from '@/application/candidate-settings/ports/CandidateSettingsRepository';
import type { CandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import type { UserId } from '@/domain/shared/brand';
import { ApplicationError } from '@/domain/shared/errors';

export class SaveCandidateSettingsUseCase {
  public constructor(
    private readonly repository: CandidateSettingsRepository,
  ) {}

  public async execute(
    userId: UserId,
    settings: CandidateSettings,
  ): Promise<CandidateSettings> {
    const result = candidateSettingsSchema.safeParse(settings);
    if (!result.success) {
      throw new ApplicationError(
        'invalid_request',
        'As preferências recebidas não são válidas.',
        { cause: result.error },
      );
    }

    return this.repository.saveForCandidate(userId, result.data);
  }
}
