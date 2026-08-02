import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

async function expectCleanAuthState(page: Page) {
  const metrics = await collectVisibleUiMetrics(page);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(metrics.smallText).toEqual([]);
  expect(metrics.shortTargets).toEqual([]);
  expect(await collectWcagViolations(page)).toEqual([]);
}

test.describe('recuperação da conta', () => {
  test('explica um link de confirmação ausente', async ({ page }) => {
    const pageErrors = monitorPageErrors(page);
    await page.goto('/verificar-email', { waitUntil: 'networkidle' });

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Link inválido ou expirado',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Iniciar sessão' }),
    ).toHaveAttribute('href', '/login');
    await expectCleanAuthState(page);
    expect(pageErrors).toEqual([]);
  });

  test('valida o email antes de pedir recuperação', async ({ page }) => {
    const pageErrors = monitorPageErrors(page);
    await page.goto('/recuperar-senha', { waitUntil: 'networkidle' });

    await page
      .getByRole('button', { name: 'Enviar link de recuperação' })
      .click();
    await expect(page.getByText('Introduza o seu email.')).toBeVisible();
    await expectCleanAuthState(page);
    expect(pageErrors).toEqual([]);
  });

  test('explica um link de redefinição ausente', async ({ page }) => {
    const pageErrors = monitorPageErrors(page);
    await page.goto('/redefinir-senha', { waitUntil: 'networkidle' });

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Link inválido ou expirado',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Pedir novo link' }),
    ).toHaveAttribute('href', '/recuperar-senha');
    await expectCleanAuthState(page);
    expect(pageErrors).toEqual([]);
  });
});
