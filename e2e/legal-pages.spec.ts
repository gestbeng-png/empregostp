import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

const legalPages = [
  { heading: 'Termos de utilização', route: '/termos' },
  { heading: 'Cookies', route: '/cookies' },
  {
    heading: 'A sua privacidade é uma prioridade',
    route: '/politica-privacidade',
  },
];

test.describe('páginas legais', () => {
  for (const legalPage of legalPages) {
    test(`${legalPage.route} mantém uma estrutura de leitura acessível`, async ({
      page,
    }) => {
      const pageErrors = monitorPageErrors(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const response = await page.goto(legalPage.route, {
        waitUntil: 'networkidle',
      });

      expect(response?.ok()).toBe(true);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(
        page.getByRole('heading', { level: 1, name: legalPage.heading }),
      ).toBeVisible();

      const metrics = await collectVisibleUiMetrics(page);
      expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
      expect(metrics.smallText).toEqual([]);
      expect(metrics.shortTargets).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(await collectWcagViolations(page)).toEqual([]);
    });
  }

  test('a política apresenta o contacto oficial', async ({ page }) => {
    await page.goto('/politica-privacidade', { waitUntil: 'networkidle' });
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: 'suporte@empregos.st', exact: true }),
    ).toHaveAttribute('href', 'mailto:suporte@empregos.st');
  });
});
