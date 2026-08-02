import { z } from 'zod';

import {
  candidateLanguageValues,
  createDefaultCandidateSettings,
  profileVisibilityValues,
  type CandidateSettings,
} from '@/domain/candidate-settings/CandidateSettings';

const notificationsSchema = z
  .object({
    directMessages: z.boolean(),
    interviewUpdates: z.boolean(),
    jobAlerts: z.boolean(),
    platformUpdates: z.boolean(),
    weeklyDigest: z.boolean(),
  })
  .strict();

const privacySchema = z
  .object({
    allowSearchEngines: z.boolean(),
    profileVisibility: z.enum(profileVisibilityValues),
    showActivityStatus: z.boolean(),
    showContactInfo: z.boolean(),
  })
  .strict();

export const candidateSettingsSchema: z.ZodType<CandidateSettings> = z
  .object({
    language: z.enum(candidateLanguageValues),
    notifications: notificationsSchema,
    privacy: privacySchema,
  })
  .strict();

export const candidateSettingsRequestSchema = z
  .object({ settings: candidateSettingsSchema })
  .strict();

export const candidateSettingsResponseSchema = z
  .object({ settings: candidateSettingsSchema })
  .strict();

const persistedSettingsSchema = z
  .object({
    language: z.enum(candidateLanguageValues).optional(),
    notifications: notificationsSchema.partial().optional(),
    privacy: privacySchema.partial().optional(),
  })
  .passthrough();

export function parsePersistedCandidateSettings(
  value: unknown,
): CandidateSettings {
  const defaults = createDefaultCandidateSettings();
  const result = persistedSettingsSchema.safeParse(value);

  if (!result.success) {
    return defaults;
  }

  return {
    language: result.data.language ?? defaults.language,
    notifications: {
      ...defaults.notifications,
      ...result.data.notifications,
    },
    privacy: {
      ...defaults.privacy,
      ...result.data.privacy,
    },
  };
}
