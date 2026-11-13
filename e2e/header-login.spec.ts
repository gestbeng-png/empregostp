import { expect, test } from '@playwright/test';

import { collectWcagViolations, monitorPageErrors } from './ui-audit';

for (const path of ['/', '/404']) {
  test(`botão de login em ${path} mantém formato, cores e navegação`, async ({
    page,
  }) => {
    const errors = monitorPageErrors(page);
    await page.route('**/api/news', (route) =>
      route.fulfill({ json: { news: [] } }),
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    // A primeira interação resolve a sessão adiada das páginas públicas.
    await page.keyboard.press('Tab');
    const header = page.getByRole('banner');
    const toggle = header.getByRole('button', { name: 'Abrir menu' });
    if (await toggle.isVisible()) await toggle.click();
    const login = header.getByRole('link', { name: 'Iniciar sessão' });
    await expect(login).toBeVisible({ timeout: 15_000 });
    await expect(login).toHaveAttribute('href', '/login');
    await expect(login).toHaveCSS('border-radius', '999px');
    await expect(login).toHaveCSS('background-color', 'rgb(6, 75, 181)');
    const circle = login.locator('span[aria-hidden="true"]');
    await expect(circle).toHaveCSS('border-radius', '50%');
    await expect(circle).toHaveCSS('background-color', 'rgb(218, 255, 69)');
    expect(
      await circle.evaluate((element) => {
        const { width, height } = element.getBoundingClientRect();
        return Math.abs(width - height);
      }),
    ).toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(await collectWcagViolations(page)).toEqual([]);
    expect(errors).toEqual([]);

    await login.focus();
    await expect(login).toBeFocused();
    await login.press('Enter');
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });
}
