import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/news', (route) =>
    route.fulfill({ json: { news: [] } }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/verificados', { waitUntil: 'domcontentloaded' });
});

test('os filtros funcionam e não alteram os destinos dos perfis', async ({
  page,
}) => {
  const category = page.getByRole('combobox', {
    name: 'Categoria',
    exact: true,
  });
  const experience = page.getByRole('combobox', {
    name: 'Experiência',
    exact: true,
  });
  const search = page.getByRole('searchbox', { name: 'Pesquisar talentos' });
  await expect(category).toBeVisible();
  const resultLinks = page.locator('#verified-talent-results li > a');
  const total = await resultLinks.count();
  if (total) {
    const originalLinks = await resultLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );
    await category.selectOption({ index: 1 });
    await expect(category).not.toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Limpar filtros' }),
    ).toBeVisible();
    const filteredLinks = await resultLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );
    expect(filteredLinks.every((href) => originalLinks.includes(href))).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(resultLinks).toHaveCount(total);
    await experience.selectOption({ index: 1 });
    await expect(experience).not.toHaveValue('');
  }
  await search.fill('zz-sem-correspondencia-de-teste');
  await expect(
    page.getByRole('heading', {
      name: 'Nenhum talento corresponde aos filtros',
    }),
  ).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL('/verificados');
  await page.getByRole('button', { name: 'Ver todos os talentos' }).click();
  await expect(category).toHaveValue('');
  await expect(experience).toHaveValue('');
  await expect(search).toHaveValue('');
  await expect(resultLinks).toHaveCount(total);
});

test('a barra cabe no ecrã e é acessível por teclado', async ({
  page,
}, testInfo) => {
  const filters = page.getByRole('search', { name: 'Filtrar talentos' });
  await expect(filters).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  for (const control of [
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
    page.getByRole('combobox', { name: 'Experiência', exact: true }),
    page.getByRole('searchbox', { name: 'Pesquisar talentos' }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await control.focus();
    await expect(control).toBeFocused();
  }
  const results = await new AxeBuilder({ page })
    .include('form[aria-label="Filtrar talentos"]')
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('searchbox', { name: 'Pesquisar talentos' }).blur();
  await page.screenshot({
    path: testInfo.outputPath('verified-talent-filters.png'),
    fullPage: true,
  });
});

test('mantém a barra utilizável em ecrãs de 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(
    page.getByRole('combobox', { name: 'Categoria', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Experiência', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page
    .getByRole('searchbox', { name: 'Pesquisar talentos' })
    .fill('nenhum talento para este teste');
  await expect(
    page.getByRole('button', { name: 'Limpar filtros' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});
