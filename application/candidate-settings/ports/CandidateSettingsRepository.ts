import type { CandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import type { UserId } from '@/domain/shared/brand';

export interface CandidateSettingsRepository {
  findByUserId(userId: UserId): Promise<CandidateSettings>;
  saveForCandidate(
    userId: UserId,
    settings: CandidateSettings,
  ): Promise<CandidateSettings>;
}
