import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

for (const path of [
  '/esta-pagina-nao-existe-teste-404',
  '/recursos/esta-pagina-nao-existe-teste-404',
]) {
  test(`404 em ${path} preserva estado HTTP e caminhos de recuperação`, async ({
    page,
  }) => {
    const errors = monitorPageErrors(page);
    await page.route('**/api/news', (route) =>
      route.fulfill({ json: { news: [] } }),
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(path);
    await expect(page).toHaveTitle('Página não encontrada | EmpregoSTP');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,follow',
    );
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Esta página não está por aqui.',
      }),
    ).toBeVisible();

    const home = page.getByRole('link', {
      name: 'Voltar ao início',
      exact: true,
    });
    const jobs = page.getByRole('link', {
      name: 'Explorar vagas',
      exact: true,
    });
    await expect(home).toHaveAttribute('href', '/');
    await expect(jobs).toHaveAttribute('href', '/vagas');
    await home.focus();
    await page.keyboard.press('Tab');
    await expect(jobs).toBeFocused();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
