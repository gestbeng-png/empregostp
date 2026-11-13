import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

// Fixtures sintéticas apenas para testes de UI; não são testemunhos reais
// nem verificam a integração com a API ou a aprovação no servidor.
const TEST_TESTIMONIALS = [
  {
    id: 'test-testimonial-1',
    name: 'Testemunho de teste 1',
    role: 'Fixture sintética de teste',
    rating: 5,
    message: 'Conteúdo sintético para testar o primeiro slide do carrossel.',
  },
  {
    id: 'test-testimonial-2',
    name: 'Testemunho de teste 2',
    role: 'Fixture sintética de teste',
    rating: 4,
    message: 'Conteúdo sintético para testar o segundo slide do carrossel.',
  },
] as const;

async function mockTestimonials(
  page: Page,
  testimonials: ReadonlyArray<(typeof TEST_TESTIMONIALS)[number]>,
) {
  await page.route('**/api/testimonials', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ testimonials }),
      });
      return;
    }

    await route.abort();
  });
}

test.describe('página sobre o Emprego STP', () => {
  test('/sobre-nos mantém as interações acessíveis com fixtures sintéticas', async ({
    page,
  }) => {
    await mockTestimonials(page, TEST_TESTIMONIALS);
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

    const missionRegion = page.getByRole('region', { name: 'A nossa missão' });
    await expect(missionRegion).toContainText(
      'Conectar talento e oportunidade',
    );
    await expect(missionRegion.getByRole('listitem')).toHaveCount(5);

    const teamRegion = page.getByRole('region', { name: 'A Nossa Equipa' });
    await expect(teamRegion.getByRole('article')).toHaveCount(3);
    // Mesma grelha de /carreira: só a foto e as redes de cada membro.
    await expect(
      teamRegion.getByRole('img', { name: 'Joel Almeida' }),
    ).toBeVisible();
    await expect(
      teamRegion.getByRole('link', { name: 'LinkedIn de Joel Almeida' }),
    ).toHaveAttribute('target', '_blank');

    const audienceRegion = page.getByRole('region', {
      name: 'Uma plataforma para todos',
    });
    await expect(audienceRegion.getByRole('article')).toHaveCount(3);

    const testimonialsRegion = page.getByRole('region', {
      name: 'O que dizem de nós',
    });
    await expect(
      testimonialsRegion.locator('[data-testimonial-slide="true"]'),
    ).toHaveCount(2);
    await expect(
      testimonialsRegion.locator('[data-active="true"]'),
    ).toContainText(TEST_TESTIMONIALS[0].name);
    await testimonialsRegion
      .getByRole('button', { name: 'Testemunho seguinte' })
      .click();
    await expect(
      testimonialsRegion.locator('[data-active="true"]'),
    ).toContainText(TEST_TESTIMONIALS[1].name);

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
    await expect(shareRegion.getByRole('status')).toContainText(
      'Indique o seu nome',
    );
    await expect(shareRegion.getByRole('status')).toBeVisible();

    await expect(
      page.getByRole('link', { name: 'Junte-se à nossa equipa' }),
    ).toHaveAttribute('href', '/carreira');

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });

  test('o carrossel atualiza automaticamente com fixtures sintéticas', async ({
    page,
  }) => {
    await mockTestimonials(page, TEST_TESTIMONIALS);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/sobre-nos', { waitUntil: 'domcontentloaded' });

    const testimonialsRegion = page.getByRole('region', {
      name: 'O que dizem de nós',
    });
    const activeTestimonial = testimonialsRegion.locator(
      '[data-active="true"]',
    );

    await expect(activeTestimonial).toContainText(TEST_TESTIMONIALS[0].name);
    await expect(activeTestimonial).toContainText(TEST_TESTIMONIALS[1].name, {
      timeout: 5000,
    });
  });

  test('a API vazia apresenta o estado vazio sem testemunhos fictícios', async ({
    page,
  }) => {
    await mockTestimonials(page, []);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/sobre-nos', { waitUntil: 'domcontentloaded' });

    const testimonialsRegion = page.getByRole('region', {
      name: 'O que dizem de nós',
    });
    await expect(testimonialsRegion.getByRole('status')).toContainText(
      'Ainda não há testemunhos publicados.',
    );
    await expect(
      testimonialsRegion.locator('[data-testimonial-slide="true"]'),
    ).toHaveCount(0);
    await expect(testimonialsRegion.getByRole('button')).toHaveCount(0);
    await expect(testimonialsRegion).not.toContainText('Ana Trindade');
    await expect(testimonialsRegion).not.toContainText('Nelson Costa');
    await expect(testimonialsRegion).not.toContainText('Testemunho de teste');
    await expect(
      page.getByRole('button', { name: 'Enviar', exact: true }),
    ).toBeVisible();
  });
});
