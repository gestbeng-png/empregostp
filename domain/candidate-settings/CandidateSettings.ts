export const profileVisibilityValues = [
  'recruiters',
  'public',
  'private',
] as const;

export const candidateLanguageValues = ['pt-PT', 'pt-ST', 'en'] as const;

export type ProfileVisibility = (typeof profileVisibilityValues)[number];
export type CandidateLanguage = (typeof candidateLanguageValues)[number];

export interface CandidateNotificationSettings {
  directMessages: boolean;
  interviewUpdates: boolean;
  jobAlerts: boolean;
  platformUpdates: boolean;
  weeklyDigest: boolean;
}

export interface CandidatePrivacySettings {
  allowSearchEngines: boolean;
  profileVisibility: ProfileVisibility;
  showActivityStatus: boolean;
  showContactInfo: boolean;
}

export interface CandidateSettings {
  language: CandidateLanguage;
  notifications: CandidateNotificationSettings;
  privacy: CandidatePrivacySettings;
}

export function createDefaultCandidateSettings(): CandidateSettings {
  return {
    language: 'pt-PT',
    notifications: {
      directMessages: true,
      interviewUpdates: true,
      jobAlerts: true,
      platformUpdates: false,
      weeklyDigest: true,
    },
    privacy: {
      allowSearchEngines: false,
      profileVisibility: 'recruiters',
      showActivityStatus: true,
      showContactInfo: false,
    },
  };
}
