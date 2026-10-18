import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

const candidateRoutes = [
  {
    path: '/candidatos',
    heading: /Construa a sua carreira em São Tomé com mais confiança/i,
    currentMarket: 'Para nacional',
    assurance: 'Plano gratuito disponível, sem compromisso',
    serviceHeading: 'Perfil profissional para o mercado nacional',
  },
  {
    path: '/candidatos/nacional',
    heading: /Construa a sua carreira em São Tomé com mais confiança/i,
    currentMarket: 'Para nacional',
    assurance: 'Plano gratuito disponível, sem compromisso',
    serviceHeading: 'Perfil profissional para o mercado nacional',
  },
  {
    path: '/candidatos/internacional',
    heading: /Descubra novas oportunidades em São Tomé e Príncipe/i,
    currentMarket: 'Para internacional',
    assurance:
      'Apoio para candidatos internacionais que querem trabalhar em STP',
    serviceHeading: 'Preparação para trabalhar em São Tomé e Príncipe',
  },
] as const;

test.describe('catálogo público para candidatos', () => {
  for (const route of candidateRoutes) {
    test(`${route.path} carrega com conteúdo íntegro`, async ({ page }) => {
      const pageErrors = monitorPageErrors(page);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      const response = await page.goto(route.path, {
        waitUntil: 'networkidle',
      });

      expect(response?.ok()).toBe(true);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 1, name: route.heading }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('navigation', { name: 'Catálogos de candidatos' })
          .getByRole('link', { name: route.currentMarket, exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(
        page.getByText(route.assurance, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', {
          level: 3,
          name: route.serviceHeading,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', {
          name: 'Escolher o plano Profissional',
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();

      const metrics = await collectVisibleUiMetrics(page);

      expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
      expect(metrics.smallText).toEqual([]);
      expect(metrics.shortTargets).toEqual([]);
      expect(pageErrors).toEqual([]);

      expect(await collectWcagViolations(page)).toEqual([]);
    });
  }

  test('mantém preços e planos legíveis em tablet', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A validação tablet é executada uma vez em Chromium.',
    );

    const pageErrors = monitorPageErrors(page);

    await page.setViewportSize({ width: 820, height: 1180 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/candidatos/nacional', {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);

    const premiumCard = page.getByRole('article', {
      name: 'Premium',
      exact: true,
    });
    const premiumPrice = premiumCard.getByText('200 Dobras', { exact: true });
    await expect(premiumCard).toBeVisible();
    await expect(premiumPrice).toBeVisible();

    const [cardBox, priceBox] = await Promise.all([
      premiumCard.boundingBox(),
      premiumPrice.boundingBox(),
    ]);
    expect(cardBox).not.toBeNull();
    expect(priceBox).not.toBeNull();
    expect(priceBox?.x).toBeGreaterThanOrEqual(cardBox?.x ?? 0);
    expect((priceBox?.x ?? 0) + (priceBox?.width ?? 0)).toBeLessThanOrEqual(
      (cardBox?.x ?? 0) + (cardBox?.width ?? 0) + 1,
    );

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
