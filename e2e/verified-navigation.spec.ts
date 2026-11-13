import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/news', (route) =>
    route.fulfill({ json: { news: [] } }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('os atalhos de recrutamento da empresa abrem /verificados', async ({
  page,
}) => {
  await page.goto('/empresas', { waitUntil: 'domcontentloaded' });
  const searchCandidates = page.getByRole('main').getByRole('link', {
    name: 'Procurar candidatos',
    exact: true,
  });
  await expect(searchCandidates).toHaveAttribute('href', '/verificados');
  await expect(
    page
      .locator('nav[aria-label="Navegação rápida"] a')
      .filter({ hasText: /^Candidatos$/ }),
  ).toHaveAttribute('href', '/verificados');
  await searchCandidates.click();
  await expect(page).toHaveURL('/verificados');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Quem já está verificado no EmpregoSTP',
    }),
  ).toBeVisible();
});

test('home e rodapé distinguem os verificados da página para candidatos', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const verifiedSection = page.getByRole('region', {
    name: 'Encontre Candidatos Qualificados',
  });
  await expect(
    verifiedSection.getByRole('link', { name: 'Explorar', exact: true }),
  ).toHaveAttribute('href', '/verificados');
  const header = page.getByRole('banner');
  const menuToggle = header.getByRole('button', { name: 'Abrir menu' });
  if (await menuToggle.isVisible()) await menuToggle.click();
  await expect(
    header.getByRole('link', { name: 'Para candidatos', exact: true }),
  ).toHaveAttribute('href', '/candidatos');
  if (await header.getByRole('button', { name: 'Fechar menu' }).isVisible())
    await header.getByRole('button', { name: 'Fechar menu' }).click();
  const footerCandidates = page.getByRole('contentinfo').getByRole('link', {
    name: 'Procurar candidatos',
    exact: true,
  });
  await expect(footerCandidates).toHaveAttribute('href', '/verificados');
  await footerCandidates.click();
  await expect(page).toHaveURL('/verificados');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Quem já está verificado no EmpregoSTP',
    }),
  ).toBeVisible();
});
