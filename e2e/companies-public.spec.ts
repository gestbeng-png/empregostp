import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('página pública para empresas', () => {
  test('/empresas carrega com conteúdo íntegro', async ({ page }, testInfo) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/empresas', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Recrutamento para empresas/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Ferramentas para contratar com confiança',
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Comece gratuitamente e escolha um plano quando precisar de mais alcance.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Publicação simples', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();

    if (testInfo.project.name === 'mobile-chromium') {
      const quickNavigation = page.getByRole('navigation', {
        name: 'Navegação rápida',
      });
      await expect(quickNavigation).toBeVisible();
      await expect(
        quickNavigation.getByRole('link', { name: 'Empresas', exact: true }),
      ).toHaveAttribute('aria-current', 'page');
    }

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });

  test('mantém a composição íntegra em tablet', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A validação tablet é executada uma vez em Chromium.',
    );

    const pageErrors = monitorPageErrors(page);

    await page.setViewportSize({ width: 820, height: 1180 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/empresas', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByText(/Recrutamento assistido por especialistas/i),
    ).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
