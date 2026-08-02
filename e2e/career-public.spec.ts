import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('serviços de carreira', () => {
  test('/carreira apresenta ações reais e acessíveis', async ({ page }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/carreira', {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Acelere a sua carreira com apoio profissional',
      }),
    ).toBeVisible();

    await expect(
      page.getByRole('link', { name: 'Agendar sessão' }),
    ).toHaveAttribute('href', '/sobre-nos#contactos');
    await expect(
      page.getByRole('link', { name: 'Pedir informações' }).first(),
    ).toHaveAttribute('href', '/sobre-nos#contactos');
    await expect(
      page.getByRole('link', { name: 'Agendar consulta gratuita' }),
    ).toHaveAttribute('href', '/sobre-nos#contactos');

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
