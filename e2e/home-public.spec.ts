import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('página inicial', () => {
  test('carrega, valida a newsletter e encaminha a pesquisa', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/', { waitUntil: 'load' });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Conectando Talentos ao Sucesso/i,
      }),
    ).toBeVisible();

    await page
      .getByLabel('Email para subscrever a newsletter')
      .fill('email@invalido');
    await page.getByRole('button', { name: 'Subscrever' }).click();
    await expect(
      page.getByRole('status').getByText('Introduza um email válido.'),
    ).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);

    const searchInput = page.getByLabel('Pesquisar vagas na homepage');
    await searchInput.fill('design');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/vagas\?search=design$/, {
      timeout: 15_000,
    });
  });
});
