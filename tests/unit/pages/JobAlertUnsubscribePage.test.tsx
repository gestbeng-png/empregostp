/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import CancelarAlertaPage from '../../../pages/alertas/cancelar';

describe('página de cancelamento de alerta', () => {
  beforeEach(() => {
    window.history.replaceState(
      null,
      '',
      '/alertas/cancelar#alert=alert-1&token=abcdefghijklmnopqrstuvwxyzABCDEFGH123456789',
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Alerta cancelado.' }),
    }) as jest.Mock;
  });

  test('preserva as credenciais numa montagem Strict Mode e exige confirmação', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <CancelarAlertaPage />
      </StrictMode>,
    );

    const confirmButton = await screen.findByRole('button', {
      name: 'Confirmar cancelamento',
    });
    expect(window.location.hash).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();

    await user.click(confirmButton);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/job-alerts/unsubscribe',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            alertId: 'alert-1',
            token: 'abcdefghijklmnopqrstuvwxyzABCDEFGH123456789',
          }),
        }),
      ),
    );
    expect(await screen.findByText('Alerta cancelado.')).toBeVisible();
  });
});
