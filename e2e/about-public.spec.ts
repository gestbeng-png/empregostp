import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('página sobre o Emprego STP', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/testimonials', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ testimonials: [] }),
        });
        return;
      }

      await route.continue();
    });
  });

  test('/sobre-nos carrega e mantém as interações acessíveis', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/sobre-nos', {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Pessoas focadas em aproximar talento e oportunidade',
      }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { level: 2, name: 'Cada vaga, uma árvore' }),
    ).toBeVisible();

    const teamRegion = page.getByRole('region', { name: 'A Nossa Equipa' });
    await expect(teamRegion.getByRole('article')).toHaveCount(3);
    const joelCard = teamRegion
      .getByRole('article')
      .filter({ hasText: 'Joel Almeida' });
    await expect(joelCard).toBeVisible();
    await expect(joelCard.getByText('Gestor', { exact: true })).toBeVisible();

    const audienceRegion = page.getByRole('region', {
      name: 'Uma plataforma para todos',
    });
    await expect(audienceRegion.getByRole('article')).toHaveCount(4);

    const testimonialsRegion = page.getByRole('region', {
      name: 'O que dizem de nós',
    });
    await expect(
      testimonialsRegion.locator('[data-testimonial-slide="true"]'),
    ).toHaveCount(2);
    await expect(
      testimonialsRegion.locator('[data-active="true"]'),
    ).toContainText('Ana Trindade');
    await testimonialsRegion
      .getByRole('button', { name: 'Testemunho seguinte' })
      .click();
    await expect(
      testimonialsRegion.locator('[data-active="true"]'),
    ).toContainText('Nelson Costa');

    const shareRegion = page.getByRole('region', {
      name: 'Quer construir connosco o futuro do emprego em São Tomé e Príncipe?',
    });
    await shareRegion.getByLabel('Nome', { exact: true }).fill('A');
    await shareRegion
      .locator('#testimonial-message')
      .fill('Uma experiência válida para testar o formulário.');
    await shareRegion
      .getByRole('button', { name: 'Enviar', exact: true })
      .click();
    await expect(
      page.getByRole('status').getByText('Indique o seu nome'),
    ).toBeVisible();

    const joinTrigger = page.getByRole('button', {
      name: 'Junte-se à nossa equipa',
    });
    await joinTrigger.click();
    const dialog = page.getByRole('dialog', {
      name: 'Junte-se à nossa equipa',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Nome')).toBeVisible();
    await expect(dialog.getByLabel('Email')).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Fechar formulário' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(joinTrigger).toBeFocused();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });

  test('o carrossel atualiza automaticamente sem uma espera longa', async ({
    page,
  }) => {
    await page.goto('/sobre-nos', { waitUntil: 'domcontentloaded' });

    const testimonialsRegion = page.getByRole('region', {
      name: 'O que dizem de nós',
    });
    const activeTestimonial = testimonialsRegion.locator(
      '[data-active="true"]',
    );

    await expect(activeTestimonial).toContainText('Ana Trindade');
    await expect(activeTestimonial).toContainText('Nelson Costa', {
      timeout: 5000,
    });
  });
});
