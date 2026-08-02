import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { e2eCompany } from './fixtures';
import { collectVisibleUiMetrics, monitorPageErrors } from './ui-audit';

async function loginCompany(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(e2eCompany.email);
  await page.getByLabel('Senha').fill(e2eCompany.password);
  await page
    .getByRole('button', { name: 'Iniciar sessão', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/empresa/, { timeout: 20_000 });
}

async function openDashboardNavigation(page: Page) {
  const menuButton = page.getByRole('button', { name: 'Abrir menu' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
}

test.describe('painel da empresa', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.FIREBASE_AUTH_EMULATOR_HOST,
      'Esta jornada requer os emuladores Firebase.',
    );
    await loginCompany(page);
  });

  test('carrega a visão geral e mantém as métricas visuais', async ({
    page,
  }) => {
    const errors = monitorPageErrors(page);
    await expect(
      page.getByRole('heading', { name: /Olá, Empresa E2E/ }),
    ).toBeVisible();
    await expect(
      page.getByText('Assistente de operações').first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Abrir perfil da empresa' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Perfil empresa' }),
    ).toHaveCount(0);

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('apresenta planos e confirmação acessíveis', async ({ page }) => {
    await openDashboardNavigation(page);
    await page.getByRole('button', { name: 'Planos' }).click();
    await expect(
      page.getByRole('heading', {
        name: 'Escolha o plano certo para recrutar',
      }),
    ).toBeVisible();

    const professionalPlan = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: 'Profissional' }),
    });
    await professionalPlan
      .getByRole('button', { name: 'Escolher plano' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Profissional' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test('apresenta o formulário e o histórico do Serviço RH', async ({
    page,
  }) => {
    await openDashboardNavigation(page);
    await page.getByRole('button', { name: 'Serviço RH' }).click();
    await expect(
      page.getByRole('heading', { name: 'Solicitar apoio da equipa RH' }),
    ).toBeVisible();
    await expect(page.getByLabel('Serviço pretendido')).toBeVisible();
    await expect(page.getByLabel('Assunto')).toBeVisible();
    await expect(
      page.getByText('Triagem para assistente de operações'),
    ).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
  });
});
