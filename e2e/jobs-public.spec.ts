import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('página pública de vagas', () => {
  test('/vagas mantém pesquisa, filtros e visualizações acessíveis', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/vagas', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Encontre a vaga certa para o seu próximo passo.',
      }),
    ).toBeAttached();
    await expect(page.getByLabel('Ordenar vagas')).toBeVisible();
    const applyLinks = page.getByRole('link', {
      name: 'Candidatar-se',
      exact: true,
    });
    expect(await applyLinks.count()).toBeGreaterThan(0);
    await expect(applyLinks.first()).toBeVisible();

    const mobileFilters = page.getByRole('button', {
      name: 'Filtros',
      exact: true,
    });
    if (await mobileFilters.isVisible()) {
      await mobileFilters.click();
    }

    const firstFilter = page.getByRole('checkbox').first();
    if (await firstFilter.count()) {
      await firstFilter.check();
      await expect(firstFilter).toBeChecked();
    }

    await page
      .getByLabel('Email para receber o alerta de vagas')
      .fill('email@invalido');
    await page.getByRole('button', { name: 'Ativar alerta' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Introduza um email válido.',
    );

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
