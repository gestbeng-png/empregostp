import type { CandidateSettingsRepository } from '@/application/candidate-settings/ports/CandidateSettingsRepository';
import type { CandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import type { UserId } from '@/domain/shared/brand';

export class GetCandidateSettingsUseCase {
  public constructor(
    private readonly repository: CandidateSettingsRepository,
  ) {}

  public async execute(userId: UserId): Promise<CandidateSettings> {
    return this.repository.findByUserId(userId);
  }
}
