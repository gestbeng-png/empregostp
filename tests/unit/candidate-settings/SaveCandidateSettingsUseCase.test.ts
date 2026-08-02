import type { CandidateSettingsRepository } from '@/application/candidate-settings/ports/CandidateSettingsRepository';
import { SaveCandidateSettingsUseCase } from '@/application/candidate-settings/use-cases/SaveCandidateSettingsUseCase';
import {
  createDefaultCandidateSettings,
  type CandidateSettings,
} from '@/domain/candidate-settings/CandidateSettings';
import { toUserId, type UserId } from '@/domain/shared/brand';

class InMemoryCandidateSettingsRepository implements CandidateSettingsRepository {
  public saved: CandidateSettings | null = null;

  public async findByUserId(userId: UserId): Promise<CandidateSettings> {
    void userId;
    return this.saved ?? createDefaultCandidateSettings();
  }

  public async saveForCandidate(
    userId: UserId,
    settings: CandidateSettings,
  ): Promise<CandidateSettings> {
    void userId;
    this.saved = settings;
    return settings;
  }
}

describe('SaveCandidateSettingsUseCase', () => {
  it('valida e entrega as preferências ao repositório', async () => {
    const repository = new InMemoryCandidateSettingsRepository();
    const useCase = new SaveCandidateSettingsUseCase(repository);
    const settings = createDefaultCandidateSettings();
    settings.notifications.weeklyDigest = false;

    await expect(
      useCase.execute(toUserId('candidate-1'), settings),
    ).resolves.toEqual(settings);
    expect(repository.saved).toEqual(settings);
  });

  it('recusa dados inválidos antes de chamar a persistência', async () => {
    const repository = new InMemoryCandidateSettingsRepository();
    const useCase = new SaveCandidateSettingsUseCase(repository);
    const invalid = {
      ...createDefaultCandidateSettings(),
      language: 'fr',
    } as unknown as CandidateSettings;

    await expect(
      useCase.execute(toUserId('candidate-1'), invalid),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(repository.saved).toBeNull();
  });
});
