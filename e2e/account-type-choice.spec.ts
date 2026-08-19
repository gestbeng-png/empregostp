import { expect, test } from '@playwright/test';

test.describe('entrada no registo', () => {
  test('o botão do header abre diretamente o registo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Abrir menu' }).click();

    const createAccountLink = page
      .getByRole('link', { name: 'Criar conta' })
      .first();
    await expect(createAccountLink).toHaveAttribute('href', '/register');

    await createAccountLink.click();
    await expect(page).toHaveURL('/register');
    await expect(
      page.getByRole('group', { name: 'Tipo de conta' }),
    ).toBeVisible();
  });

  test('a rota antiga já não existe', async ({ page }) => {
    const response = await page.goto('/escolha-tipo', {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL('/escolha-tipo');
  });
});
