import {
  candidateSettingsRequestSchema,
  parsePersistedCandidateSettings,
} from '@/application/candidate-settings/contracts/candidateSettingsSchema';
import { createDefaultCandidateSettings } from '@/domain/candidate-settings/CandidateSettings';

describe('candidateSettingsSchema', () => {
  it('aceita o contrato completo enviado pelo formulário', () => {
    const settings = createDefaultCandidateSettings();

    expect(candidateSettingsRequestSchema.safeParse({ settings }).success).toBe(
      true,
    );
  });

  it('rejeita valores desconhecidos e propriedades inesperadas', () => {
    const settings = createDefaultCandidateSettings();
    const result = candidateSettingsRequestSchema.safeParse({
      settings: {
        ...settings,
        language: 'fr',
        unexpected: true,
      },
    });

    expect(result.success).toBe(false);
  });

  it('completa documentos antigos sem alterar preferências existentes', () => {
    const settings = parsePersistedCandidateSettings({
      notifications: { weeklyDigest: false },
      privacy: { profileVisibility: 'private' },
    });

    expect(settings).toEqual({
      ...createDefaultCandidateSettings(),
      notifications: {
        ...createDefaultCandidateSettings().notifications,
        weeklyDigest: false,
      },
      privacy: {
        ...createDefaultCandidateSettings().privacy,
        profileVisibility: 'private',
      },
    });
  });
});
