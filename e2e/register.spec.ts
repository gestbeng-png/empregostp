import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('criação de conta', () => {
  test('alterna o tipo de conta e valida os campos de empresa', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/register', { waitUntil: 'load' });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Criar conta' }),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Tipo de conta' }),
    ).toBeVisible();

    const companyType = page.getByRole('radio', { name: /Sou uma empresa/ });
    await companyType.check();
    await expect(companyType).toBeChecked();
    await expect(page.getByLabel('Telefone de contacto')).toBeVisible();
    await expect(page.getByLabel('NIF da empresa')).toBeVisible();
    await expect(page.getByLabel('Setor de atividade')).toBeVisible();
    await expect(page.getByLabel('Localização')).toBeVisible();

    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByText('Introduza o nome da empresa.')).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
