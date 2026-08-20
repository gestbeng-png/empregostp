import { useEffect, useMemo, useState } from 'react';

import {
  passwordChangeSchema,
  type PasswordChangeInput,
} from '@/application/auth/contracts/passwordChangeSchema';
import type { PasswordService } from '@/application/auth/ports/PasswordService';
import { parsePersistedCandidateSettings } from '@/application/candidate-settings/contracts/candidateSettingsSchema';
import type { CandidateSettingsGateway } from '@/application/candidate-settings/ports/CandidateSettingsGateway';
import type {
  CandidateLanguage,
  CandidateNotificationSettings,
  CandidatePrivacySettings,
  CandidateSettings,
  ProfileVisibility,
} from '@/domain/candidate-settings/CandidateSettings';
import { FirebasePasswordService } from '@/infrastructure/firebase/auth/FirebasePasswordService';
import { HttpCandidateSettingsGateway } from '@/infrastructure/http/HttpCandidateSettingsGateway';
import { isNetworkError } from '@/lib/networkError';
import { pt } from '@/shared/i18n/pt';

export interface SettingsFeedback {
  message: string;
  type: 'error' | 'success';
}

export interface CandidateSettingsController {
  changePassword(): Promise<void>;
  feedback: SettingsFeedback | null;
  passwordForm: PasswordChangeInput;
  passwordSaving: boolean;
  saveSettings(): Promise<void>;
  saving: boolean;
  settings: CandidateSettings;
  supportsPassword: boolean;
  updateLanguage(value: CandidateLanguage): void;
  updateNotification(
    key: keyof CandidateNotificationSettings,
    value: boolean,
  ): void;
  updatePasswordField(key: keyof PasswordChangeInput, value: string): void;
  updatePrivacy(
    key: keyof CandidatePrivacySettings,
    value: boolean | ProfileVisibility,
  ): void;
}

interface CandidateSettingsControllerOptions {
  gateway?: CandidateSettingsGateway;
  initialSettings: unknown;
  onSettingsSaved?: (settings: CandidateSettings) => void;
  passwordService?: PasswordService;
  providerIds: readonly string[];
}

const emptyPasswordForm: PasswordChangeInput = {
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
};

function readInitialSettings(value: unknown): CandidateSettings {
  if (typeof value === 'object' && value !== null && 'settings' in value) {
    return parsePersistedCandidateSettings(value.settings);
  }
  return parsePersistedCandidateSettings(value);
}

function errorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) {
    return pt.candidateSettings.password.errors.offline;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code);
    const messages: Record<string, string> = {
      'auth/invalid-credential':
        pt.candidateSettings.password.errors.invalidCredential,
      'auth/requires-recent-login':
        pt.candidateSettings.password.errors.recentLogin,
      'auth/too-many-requests':
        pt.candidateSettings.password.errors.tooManyRequests,
      'auth/weak-password': pt.candidateSettings.password.errors.weak,
      'auth/wrong-password':
        pt.candidateSettings.password.errors.invalidCredential,
    };
    if (messages[code]) {
      return messages[code];
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

export function useCandidateSettingsController(
  options: CandidateSettingsControllerOptions,
): CandidateSettingsController {
  const gateway = useMemo(
    () => options.gateway ?? new HttpCandidateSettingsGateway(),
    [options.gateway],
  );
  const passwordService = useMemo(
    () => options.passwordService ?? new FirebasePasswordService(),
    [options.passwordService],
  );
  const [settings, setSettings] = useState<CandidateSettings>(() =>
    readInitialSettings(options.initialSettings),
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [passwordForm, setPasswordForm] =
    useState<PasswordChangeInput>(emptyPasswordForm);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setSettings(readInitialSettings(options.initialSettings));
  }, [options.initialSettings]);

  const supportsPassword = options.providerIds.includes('password');

  function updateNotification(
    key: keyof CandidateNotificationSettings,
    value: boolean,
  ): void {
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));
  }

  function updatePrivacy(
    key: keyof CandidatePrivacySettings,
    value: boolean | ProfileVisibility,
  ): void {
    setSettings((current) => ({
      ...current,
      privacy: { ...current.privacy, [key]: value },
    }));
  }

  function updateLanguage(value: CandidateLanguage): void {
    setSettings((current) => ({ ...current, language: value }));
  }

  function updatePasswordField(
    key: keyof PasswordChangeInput,
    value: string,
  ): void {
    setPasswordForm((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(): Promise<void> {
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await gateway.save(settings);
      setSettings(saved);
      options.onSettingsSaved?.(saved);
      setFeedback({
        message: pt.candidateSettings.feedback.preferencesSaved,
        type: 'success',
      });
    } catch (error) {
      setFeedback({
        message: errorMessage(error, pt.candidateSettings.feedback.saveFailed),
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(): Promise<void> {
    setFeedback(null);
    const result = passwordChangeSchema.safeParse(passwordForm);
    if (!result.success) {
      setFeedback({
        message:
          result.error.issues[0]?.message ??
          pt.candidateSettings.password.errors.generic,
        type: 'error',
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await passwordService.changePassword(result.data);
      setPasswordForm(emptyPasswordForm);
      setFeedback({
        message: pt.candidateSettings.feedback.passwordSaved,
        type: 'success',
      });
    } catch (error) {
      setFeedback({
        message: errorMessage(
          error,
          pt.candidateSettings.password.errors.generic,
        ),
        type: 'error',
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  return {
    changePassword,
    feedback,
    passwordForm,
    passwordSaving,
    saveSettings,
    saving,
    settings,
    supportsPassword,
    updateLanguage,
    updateNotification,
    updatePasswordField,
    updatePrivacy,
  };
}
