import { GetCandidateSettingsUseCase } from '@/application/candidate-settings/use-cases/GetCandidateSettingsUseCase';
import { SaveCandidateSettingsUseCase } from '@/application/candidate-settings/use-cases/SaveCandidateSettingsUseCase';
import { getAdminFirestore } from '@/infrastructure/firebase/admin';
import { FirebaseCandidateSettingsRepository } from '@/infrastructure/firebase/repositories/FirebaseCandidateSettingsRepository';

export interface ServerContainer {
  getCandidateSettings: GetCandidateSettingsUseCase;
  saveCandidateSettings: SaveCandidateSettingsUseCase;
}

export function createServerContainer(): ServerContainer {
  const candidateSettingsRepository = new FirebaseCandidateSettingsRepository(
    getAdminFirestore(),
  );

  return {
    getCandidateSettings: new GetCandidateSettingsUseCase(
      candidateSettingsRepository,
    ),
    saveCandidateSettings: new SaveCandidateSettingsUseCase(
      candidateSettingsRepository,
    ),
  };
}
