import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('escolha do tipo de conta', () => {
  test('apresenta as duas opções e mantém os destinos corretos', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/escolha-tipo', { waitUntil: 'networkidle' });

    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Escolha como pretende utilizar a plataforma',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Criar conta de candidato' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Criar conta de empresa' }),
    ).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);

    await page
      .getByRole('button', { name: 'Criar conta de candidato' })
      .click();
    await expect(page).toHaveURL('/register?type=candidato');

    await page.goto('/escolha-tipo', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Criar conta de empresa' }).click();
    await expect(page).toHaveURL('/register?type=empresa');
  });
});
