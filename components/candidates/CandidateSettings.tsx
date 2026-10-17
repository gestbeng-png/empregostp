import { domAnimation, LazyMotion, m, MotionConfig } from 'motion/react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FiAlertTriangle,
  FiBell,
  FiCheck,
  FiDownload,
  FiGlobe,
  FiLock,
  FiMail,
  FiSave,
  FiSettings,
  FiShield,
  FiTrash2,
  FiUser,
  FiX,
} from 'react-icons/fi';

import type {
  CandidateLanguage,
  CandidateSettings,
  ProfileVisibility,
} from '@/domain/candidate-settings/CandidateSettings';
import { useAccountPrivacy } from '@/presentation/candidate-settings/useAccountPrivacy';
import { useCandidateSettingsController } from '@/presentation/candidate-settings/useCandidateSettingsController';
import { pt } from '@/shared/i18n/pt';

import styles from '../../styles/CandidateSettings.module.css';

type SectionId =
  'account' | 'delete' | 'language' | 'notifications' | 'privacy';

interface SettingsSection {
  danger?: boolean;
  icon: IconType;
  id: SectionId;
  keywords: string;
  label: string;
}

const copy = pt.candidateSettings;

function formatDeletionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Sao_Tome',
  }).format(date);
}

const sections: readonly SettingsSection[] = [
  {
    id: 'account',
    label: copy.navigation.account,
    icon: FiUser,
    keywords: copy.navigation.accountKeywords,
  },
  {
    id: 'notifications',
    label: copy.navigation.notifications,
    icon: FiBell,
    keywords: copy.navigation.notificationsKeywords,
  },
  {
    id: 'privacy',
    label: copy.navigation.privacy,
    icon: FiShield,
    keywords: copy.navigation.privacyKeywords,
  },
  {
    id: 'language',
    label: copy.navigation.language,
    icon: FiGlobe,
    keywords: copy.navigation.languageKeywords,
  },
  {
    id: 'delete',
    label: copy.navigation.delete,
    icon: FiTrash2,
    keywords: copy.navigation.deleteKeywords,
    danger: true,
  },
];

interface SettingsSwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
}

function SettingsSwitch({
  checked,
  disabled = false,
  label,
  onChange,
}: SettingsSwitchProps): React.JSX.Element {
  return (
    <label
      className={[
        styles.switch,
        checked ? styles.switchOn : '',
        disabled ? styles.switchDisabled : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.srOnly}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
      />
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
    </label>
  );
}

interface PreferenceRowProps {
  checked: boolean;
  description: string;
  onChange: (checked: boolean) => void;
  title: string;
}

function PreferenceRow({
  title,
  description,
  checked,
  onChange,
}: PreferenceRowProps): React.JSX.Element {
  return (
    <div className={styles.preferenceRow}>
      <div className={styles.preferenceCopy}>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <SettingsSwitch checked={checked} label={title} onChange={onChange} />
    </div>
  );
}

interface PanelHeaderProps {
  description?: string;
  icon: IconType;
  title: string;
}

function PanelHeader({
  icon: Icon,
  title,
  description,
}: PanelHeaderProps): React.JSX.Element {
  return (
    <header className={styles.panelHeader}>
      <span className={styles.panelIcon} aria-hidden="true">
        <Icon />
      </span>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </header>
  );
}

interface CandidateSettingsUser {
  providerData?: ReadonlyArray<{ providerId: string }>;
}

interface CandidateSettingsProps {
  onOpenSupport?: () => void;
  onSettingsSaved?: (settings: CandidateSettings) => void;
  profile: unknown;
  searchQuery?: string;
  user?: CandidateSettingsUser | null;
}

export default function CandidateSettings({
  profile,
  user,
  searchQuery = '',
  onOpenSupport,
  onSettingsSaved,
}: CandidateSettingsProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>('account');
  const providerIds = useMemo(
    () => user?.providerData?.map((provider) => provider.providerId) ?? [],
    [user?.providerData],
  );
  const {
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
  } = useCandidateSettingsController({
    initialSettings: profile,
    onSettingsSaved,
    providerIds,
  });

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-PT');
    if (!query) return sections;
    return sections.filter((section) =>
      `${section.label} ${section.keywords}`
        .toLocaleLowerCase('pt-PT')
        .includes(query),
    );
  }, [searchQuery]);

  const visibleSection = filteredSections.some(
    (section) => section.id === activeSection,
  )
    ? activeSection
    : (filteredSections[0]?.id ?? null);

  const accountPrivacy = useAccountPrivacy(visibleSection === 'delete');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  async function handleDeletionSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await accountPrivacy.requestDeletion(deleteConfirmation);
    setDeleteConfirmation('');
  }

  async function handlePasswordSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await changePassword();
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>{copy.header.eyebrow}</span>
          <h1>{copy.header.title}</h1>
          <p>{copy.header.subtitle}</p>
        </div>
        <span className={styles.accountBadge}>
          <FiSettings aria-hidden="true" /> {copy.accountBadge}
        </span>
      </header>

      <div className={styles.layout}>
        <nav className={styles.sectionNav} aria-label={copy.navigation.label}>
          {filteredSections.map((section) => {
            const Icon = section.icon;
            const selected = visibleSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={[
                  styles.sectionButton,
                  selected ? styles.sectionButtonActive : '',
                  section.danger ? styles.sectionButtonDanger : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setActiveSection(section.id)}
                aria-current={selected ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        <LazyMotion features={domAnimation}>
          <MotionConfig
            reducedMotion="user"
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          >
            <m.div
              key={visibleSection ?? 'empty'}
              className={styles.panels}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {[feedback, accountPrivacy.feedback].map((item, index) =>
                item ? (
                  <div
                    key={index}
                    className={[
                      styles.feedback,
                      item.type === 'error'
                        ? styles.feedbackError
                        : styles.feedbackSuccess,
                    ].join(' ')}
                    role="status"
                  >
                    {item.type === 'success' ? (
                      <FiCheck aria-hidden="true" />
                    ) : (
                      <FiAlertTriangle aria-hidden="true" />
                    )}
                    <span>{item.message}</span>
                  </div>
                ) : null,
              )}

              {!visibleSection ? (
                <section className={styles.emptySearch}>
                  <FiSettings aria-hidden="true" />
                  <h2>{copy.emptySearch.title}</h2>
                  <p>{copy.emptySearch.description}</p>
                </section>
              ) : null}

              {visibleSection === 'account' ? (
                <>
                  <section className={styles.panel}>
                    <PanelHeader
                      icon={FiLock}
                      title={copy.password.title}
                      description={copy.password.description}
                    />

                    {supportsPassword ? (
                      <form
                        className={styles.passwordForm}
                        onSubmit={handlePasswordSubmit}
                      >
                        <label className={styles.fieldWide}>
                          <span>{copy.password.currentLabel}</span>
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={(event) =>
                              updatePasswordField(
                                'currentPassword',
                                event.currentTarget.value,
                              )
                            }
                            required
                          />
                        </label>
                        <label>
                          <span>{copy.password.newLabel}</span>
                          <input
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={passwordForm.newPassword}
                            onChange={(event) =>
                              updatePasswordField(
                                'newPassword',
                                event.currentTarget.value,
                              )
                            }
                            required
                          />
                        </label>
                        <label>
                          <span>{copy.password.confirmLabel}</span>
                          <input
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={passwordForm.confirmPassword}
                            onChange={(event) =>
                              updatePasswordField(
                                'confirmPassword',
                                event.currentTarget.value,
                              )
                            }
                            required
                          />
                        </label>
                        <div className={styles.twoFactorRow}>
                          <div>
                            <strong>{copy.password.twoFactorLabel}</strong>
                            <span>{copy.password.twoFactorDescription}</span>
                          </div>
                          <span className={styles.soonBadge}>
                            {copy.password.twoFactorSoon}
                          </span>
                          <SettingsSwitch
                            checked={false}
                            disabled
                            label={copy.password.twoFactorLabel}
                          />
                        </div>
                        <button
                          type="submit"
                          className={styles.primaryButton}
                          disabled={passwordSaving}
                        >
                          <FiLock aria-hidden="true" />
                          {passwordSaving
                            ? pt.common.saving
                            : copy.password.save}
                        </button>
                      </form>
                    ) : (
                      <div className={styles.providerNotice}>
                        <FiShield aria-hidden="true" />
                        <div>
                          <strong>{copy.password.providerTitle}</strong>
                          <span>{copy.password.providerDescription}</span>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className={styles.panel}>
                    <PanelHeader
                      icon={FiMail}
                      title={copy.notifications.emailTitle}
                      description={copy.notifications.emailDescription}
                    />
                    <div className={styles.preferenceList}>
                      <PreferenceRow
                        title={copy.notifications.rows.jobAlerts.title}
                        description={
                          copy.notifications.rows.jobAlerts.accountDescription
                        }
                        checked={settings.notifications.jobAlerts}
                        onChange={(value) =>
                          updateNotification('jobAlerts', value)
                        }
                      />
                      <PreferenceRow
                        title={copy.notifications.rows.directMessages.title}
                        description={
                          copy.notifications.rows.directMessages
                            .accountDescription
                        }
                        checked={settings.notifications.directMessages}
                        onChange={(value) =>
                          updateNotification('directMessages', value)
                        }
                      />
                      <PreferenceRow
                        title={copy.notifications.rows.interviewUpdates.title}
                        description={
                          copy.notifications.rows.interviewUpdates
                            .accountDescription
                        }
                        checked={settings.notifications.interviewUpdates}
                        onChange={(value) =>
                          updateNotification('interviewUpdates', value)
                        }
                      />
                    </div>
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={saveSettings}
                        disabled={saving}
                      >
                        <FiSave aria-hidden="true" />
                        {saving ? pt.common.saving : copy.notifications.save}
                      </button>
                    </div>
                  </section>
                </>
              ) : null}

              {visibleSection === 'notifications' ? (
                <section className={styles.panel}>
                  <PanelHeader
                    icon={FiBell}
                    title={copy.notifications.title}
                    description={copy.notifications.description}
                  />
                  <div className={styles.preferenceList}>
                    <PreferenceRow
                      title={copy.notifications.rows.jobAlerts.title}
                      description={
                        copy.notifications.rows.jobAlerts.description
                      }
                      checked={settings.notifications.jobAlerts}
                      onChange={(value) =>
                        updateNotification('jobAlerts', value)
                      }
                    />
                    <PreferenceRow
                      title={copy.notifications.rows.directMessages.title}
                      description={
                        copy.notifications.rows.directMessages.description
                      }
                      checked={settings.notifications.directMessages}
                      onChange={(value) =>
                        updateNotification('directMessages', value)
                      }
                    />
                    <PreferenceRow
                      title={copy.notifications.rows.interviewUpdates.title}
                      description={
                        copy.notifications.rows.interviewUpdates.description
                      }
                      checked={settings.notifications.interviewUpdates}
                      onChange={(value) =>
                        updateNotification('interviewUpdates', value)
                      }
                    />
                    <PreferenceRow
                      title={copy.notifications.rows.platformUpdates.title}
                      description={
                        copy.notifications.rows.platformUpdates.description
                      }
                      checked={settings.notifications.platformUpdates}
                      onChange={(value) =>
                        updateNotification('platformUpdates', value)
                      }
                    />
                    <PreferenceRow
                      title={copy.notifications.rows.weeklyDigest.title}
                      description={
                        copy.notifications.rows.weeklyDigest.description
                      }
                      checked={settings.notifications.weeklyDigest}
                      onChange={(value) =>
                        updateNotification('weeklyDigest', value)
                      }
                    />
                  </div>
                  <div className={styles.panelActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={saveSettings}
                      disabled={saving}
                    >
                      <FiSave aria-hidden="true" />
                      {saving ? pt.common.saving : copy.notifications.save}
                    </button>
                  </div>
                </section>
              ) : null}

              {visibleSection === 'privacy' ? (
                <>
                  <section className={styles.panel}>
                    <PanelHeader
                      icon={FiShield}
                      title={copy.privacy.title}
                      description={copy.privacy.description}
                    />
                    <label className={styles.selectField}>
                      <span>{copy.privacy.profileVisibility}</span>
                      <select
                        value={settings.privacy.profileVisibility}
                        onChange={(event) =>
                          updatePrivacy(
                            'profileVisibility',
                            event.currentTarget.value as ProfileVisibility,
                          )
                        }
                      >
                        <option value="recruiters">
                          {copy.privacy.visibilityOptions.recruiters}
                        </option>
                        <option value="public">
                          {copy.privacy.visibilityOptions.public}
                        </option>
                        <option value="private">
                          {copy.privacy.visibilityOptions.private}
                        </option>
                      </select>
                    </label>
                    <div className={styles.preferenceList}>
                      <PreferenceRow
                        title={copy.privacy.rows.showContactInfo.title}
                        description={
                          copy.privacy.rows.showContactInfo.description
                        }
                        checked={settings.privacy.showContactInfo}
                        onChange={(value) =>
                          updatePrivacy('showContactInfo', value)
                        }
                      />
                      <PreferenceRow
                        title={copy.privacy.rows.allowSearchEngines.title}
                        description={
                          copy.privacy.rows.allowSearchEngines.description
                        }
                        checked={settings.privacy.allowSearchEngines}
                        onChange={(value) =>
                          updatePrivacy('allowSearchEngines', value)
                        }
                      />
                      <PreferenceRow
                        title={copy.privacy.rows.showActivityStatus.title}
                        description={
                          copy.privacy.rows.showActivityStatus.description
                        }
                        checked={settings.privacy.showActivityStatus}
                        onChange={(value) =>
                          updatePrivacy('showActivityStatus', value)
                        }
                      />
                    </div>
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={saveSettings}
                        disabled={saving}
                      >
                        <FiSave aria-hidden="true" />
                        {saving ? pt.common.saving : copy.privacy.save}
                      </button>
                    </div>
                  </section>

                  <section className={styles.panel}>
                    <PanelHeader
                      icon={FiDownload}
                      title={copy.exportData.title}
                      description={copy.exportData.description}
                    />
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={accountPrivacy.exportData}
                        disabled={accountPrivacy.busy === 'export'}
                      >
                        <FiDownload aria-hidden="true" />
                        {accountPrivacy.busy === 'export'
                          ? copy.exportData.preparing
                          : copy.exportData.action}
                      </button>
                    </div>
                  </section>
                </>
              ) : null}

              {visibleSection === 'language' ? (
                <section className={styles.panel}>
                  <PanelHeader
                    icon={FiGlobe}
                    title={copy.language.title}
                    description={copy.language.description}
                  />
                  <label className={styles.selectField}>
                    <span>{copy.language.label}</span>
                    <select
                      value={settings.language}
                      onChange={(event) =>
                        updateLanguage(
                          event.currentTarget.value as CandidateLanguage,
                        )
                      }
                    >
                      <option value="pt-PT">
                        {copy.language.options.ptPT}
                      </option>
                      <option value="pt-ST">
                        {copy.language.options.ptST}
                      </option>
                      <option value="en">{copy.language.options.en}</option>
                    </select>
                  </label>
                  <div className={styles.panelActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={saveSettings}
                      disabled={saving}
                    >
                      <FiSave aria-hidden="true" />
                      {saving ? pt.common.saving : copy.language.save}
                    </button>
                  </div>
                </section>
              ) : null}

              {visibleSection === 'delete' ? (
                <section
                  className={[styles.panel, styles.dangerPanel].join(' ')}
                >
                  <PanelHeader
                    icon={FiTrash2}
                    title={copy.deleteAccount.title}
                    description={copy.deleteAccount.description}
                  />
                  {accountPrivacy.busy === 'load' ? (
                    <p role="status">{copy.deleteAccount.loading}</p>
                  ) : accountPrivacy.deletion ? (
                    <>
                      <div className={styles.dangerNotice}>
                        <FiAlertTriangle aria-hidden="true" />
                        <div>
                          <strong>{copy.deleteAccount.pendingTitle}</strong>
                          <p>
                            {copy.deleteAccount.pendingDescription.replace(
                              '{date}',
                              formatDeletionDate(
                                accountPrivacy.deletion.executeAfter,
                              ),
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={styles.panelActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={accountPrivacy.cancelDeletion}
                          disabled={accountPrivacy.busy === 'cancel'}
                        >
                          <FiX aria-hidden="true" />
                          {accountPrivacy.busy === 'cancel'
                            ? copy.deleteAccount.sending
                            : copy.deleteAccount.cancel}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.dangerNotice}>
                        <FiAlertTriangle aria-hidden="true" />
                        <div>
                          <strong>{copy.deleteAccount.noticeTitle}</strong>
                          <p>{copy.deleteAccount.notice}</p>
                          <p>{copy.deleteAccount.kept}</p>
                        </div>
                      </div>
                      <form
                        className={styles.passwordForm}
                        onSubmit={handleDeletionSubmit}
                      >
                        <label>
                          <span>{copy.deleteAccount.confirmLabel}</span>
                          <input
                            type="text"
                            autoComplete="off"
                            value={deleteConfirmation}
                            onChange={(event) =>
                              setDeleteConfirmation(event.currentTarget.value)
                            }
                            aria-describedby="delete-account-reauth"
                            required
                          />
                        </label>
                        <p id="delete-account-reauth">
                          {copy.deleteAccount.reauthHint}
                        </p>
                        <button
                          type="submit"
                          className={styles.dangerButton}
                          disabled={
                            accountPrivacy.busy === 'request' ||
                            deleteConfirmation.trim().toUpperCase() !==
                              'ELIMINAR'
                          }
                        >
                          <FiTrash2 aria-hidden="true" />
                          {accountPrivacy.busy === 'request'
                            ? copy.deleteAccount.sending
                            : copy.deleteAccount.action}
                        </button>
                      </form>
                    </>
                  )}
                  {onOpenSupport ? (
                    <div className={styles.panelActions}>
                      <button
                        type="button"
                        className={styles.sectionButton}
                        onClick={onOpenSupport}
                      >
                        <FiMail aria-hidden="true" />{' '}
                        {copy.deleteAccount.support}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </m.div>
          </MotionConfig>
        </LazyMotion>
      </div>
    </div>
  );
}
