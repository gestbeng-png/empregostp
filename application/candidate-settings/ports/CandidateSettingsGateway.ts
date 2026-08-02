import type { CandidateSettings } from '@/domain/candidate-settings/CandidateSettings';

export interface CandidateSettingsGateway {
  get(): Promise<CandidateSettings>;
  save(settings: CandidateSettings): Promise<CandidateSettings>;
}
