import { expect, test } from '@playwright/test';

test.describe('acesso às calculadoras profissionais', () => {
  for (const route of [
    '/recursos/calculadora-salarial',
    '/recursos/calculadora-impostos',
  ]) {
    test(`${route} encaminha a sessão anónima para autenticação`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
    });
  }
});
