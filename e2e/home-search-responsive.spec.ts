import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const width of [320, 390, 720]) {
  test(`pesquisa móvel a ${width}px mantém campo e botão alinhados e funcionais`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/news', (route) =>
      route.fulfill({ json: { news: [] } }),
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const input = page.getByLabel('Pesquisar vagas na homepage');
    const form = input.locator('xpath=ancestor::form');
    const button = form.getByRole('button', { name: 'Pesquisar', exact: true });
    await expect(button).toBeVisible();
    await expect(form).toHaveCSS('display', 'grid');
    await expect(input).toHaveCSS('font-size', '16px');

    await input.fill('engenharia & tecnologia');
    await expect(form).not.toHaveCSS('box-shadow', 'none');
    const layout = await form.evaluate((element) => {
      const field = element.querySelector('input');
      const submit = element.querySelector('button');
      if (!field || !submit)
        throw new Error('Formulário de pesquisa incompleto.');
      const outer = element.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const buttonRect = submit.getBoundingClientRect();
      return {
        radius: Number.parseFloat(
          getComputedStyle(element).borderTopLeftRadius,
        ),
        height: outer.height,
        gap: buttonRect.top - fieldRect.bottom,
        leftInset: buttonRect.left - outer.left,
        rightInset: outer.right - buttonRect.right,
        buttonHeight: buttonRect.height,
        buttonOverflow: submit.scrollWidth - submit.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(layout.radius).toBeLessThan(layout.height / 2);
    expect(layout.gap).toBeGreaterThanOrEqual(7);
    expect(layout.leftInset).toBeGreaterThanOrEqual(8);
    expect(layout.rightInset).toBeGreaterThanOrEqual(8);
    expect(Math.abs(layout.leftInset - layout.rightInset)).toBeLessThan(1);
    expect(layout.buttonHeight).toBeGreaterThanOrEqual(48);
    expect(layout.buttonOverflow).toBeLessThanOrEqual(0);
    expect(layout.pageOverflow).toBeLessThanOrEqual(0);

    const accessibility = await new AxeBuilder({ page })
      .include('form:has(input[aria-label="Pesquisar vagas na homepage"])')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    if (width === 390) await input.press('Enter');
    else await button.click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/vagas' &&
        url.searchParams.get('search') === 'engenharia & tecnologia',
    );
  });
}

test('a pesquisa de desktop mantém a composição horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/news', (route) =>
    route.fulfill({ json: { news: [] } }),
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const input = page.getByLabel('Pesquisar vagas na homepage');
  const form = input.locator('xpath=ancestor::form');
  await expect(form).toHaveCSS('display', 'flex');
  await expect(form).toHaveCSS('flex-direction', 'row');
  const layout = await form.evaluate((element) => {
    const outer = element.getBoundingClientRect();
    const field = element.querySelector('input');
    const submit = element.querySelector('button');
    if (!field || !submit)
      throw new Error('Formulário de pesquisa incompleto.');
    const input = field.getBoundingClientRect();
    const button = submit.getBoundingClientRect();
    return {
      height: outer.height,
      radius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
      gap: button.left - input.right,
    };
  });
  expect(layout.height).toBeLessThanOrEqual(80);
  expect(layout.radius).toBeGreaterThanOrEqual(layout.height / 2);
  expect(layout.gap).toBeGreaterThanOrEqual(0);
});
