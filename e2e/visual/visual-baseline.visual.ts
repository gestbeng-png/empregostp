import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

type Route = {
  path: string;
  role: 'public' | 'candidate' | 'company' | 'admin';
  storageState?: string;
  maskSelectors?: string[];
  critical?: boolean;
};
const manifest = process.env.VISUAL_ROUTES_FILE;
if (!manifest)
  throw new Error(
    'Defina VISUAL_ROUTES_FILE com rotas e sessões sintéticas de staging.',
  );
const routes: Route[] = JSON.parse(readFileSync(manifest, 'utf8'));
if (!Array.isArray(routes) || !routes.length)
  throw new Error('Manifesto de rotas vazio.');

for (const route of routes) {
  if (
    !route.path.startsWith('/') ||
    route.path.startsWith('//') ||
    route.path.startsWith('/api/') ||
    route.path.startsWith('/setup/') ||
    route.path.includes('?')
  )
    throw new Error('Rota de baseline inválida.');
  if (!['public', 'candidate', 'company', 'admin'].includes(route.role))
    throw new Error('Role inválido.');
  if (route.role !== 'public' && !route.storageState)
    throw new Error('Rota autenticada exige sessão sintética explícita.');
  test.describe(`${route.role} ${route.path}`, () => {
    test.use({
      storageState: route.storageState || { cookies: [], origins: [] },
    });
    test('preserva composição e estado da página', async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name.endsWith('-360') && !route.critical,
        '360 apenas para fluxos críticos.',
      );
      const response = await page.goto(route.path, {
        waitUntil: 'networkidle',
      });
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(route.path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('main')).toBeVisible();
      const mask = (route.maskSelectors || []).map((selector) =>
        page.locator(selector),
      );
      await expect(page).toHaveScreenshot(
        `${route.role}-${encodeURIComponent(route.path)}.png`,
        { fullPage: true, mask },
      );
    });
  });
}
