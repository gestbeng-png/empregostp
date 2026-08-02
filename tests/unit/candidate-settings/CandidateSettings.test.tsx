import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { candidateSettingsRequestSchema } from '@/application/candidate-settings/contracts/candidateSettingsSchema';
import CandidateSettings from '@/components/candidates/CandidateSettings';
import { createDefaultCandidateSettings } from '@/domain/candidate-settings/CandidateSettings';
import { pt } from '@/shared/i18n/pt';

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn() },
  getAuth: jest.fn(() => ({
    currentUser: {
      getIdToken: jest.fn(async () => 'candidate-token'),
    },
  })),
  reauthenticateWithCredential: jest.fn(),
  updatePassword: jest.fn(),
}));

describe('CandidateSettings', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('altera e guarda uma preferência com o contrato partilhado', async () => {
    const user = userEvent.setup();
    const onSettingsSaved = jest.fn();

    const fetchMock = jest.fn(
      async (
        _input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const rawBody: unknown =
          typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        const parsedBody = candidateSettingsRequestSchema.parse(rawBody);
        return {
          json: async () => ({ settings: parsedBody.settings }),
          ok: true,
          status: 200,
        } as Response;
      },
    );
    global.fetch = fetchMock as typeof fetch;

    render(
      <CandidateSettings
        profile={{ settings: createDefaultCandidateSettings() }}
        user={{ providerData: [{ providerId: 'password' }] }}
        onSettingsSaved={onSettingsSaved}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: pt.candidateSettings.navigation.notifications,
      }),
    );
    const weeklyDigest = screen.getByRole('checkbox', {
      name: pt.candidateSettings.notifications.rows.weeklyDigest.title,
    });
    expect(weeklyDigest).toBeChecked();

    await user.click(weeklyDigest);
    await user.click(
      screen.getByRole('button', {
        name: pt.candidateSettings.notifications.save,
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(onSettingsSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.objectContaining({ weeklyDigest: false }),
      }),
    );
    expect(
      screen.getByText(pt.candidateSettings.feedback.preferencesSaved),
    ).toBeInTheDocument();
  });
});
