import { expect, test } from '@playwright/test';

import { logout, qaCredentials, qaUnavailableReason } from './qa-auth';
import { monitorPageErrors } from './ui-audit';

/**
 * O formulário de login, conduzido como um utilizador o conduz (secção 3).
 *
 * Os restantes percursos com sessão entram pelo cookie para não repetir este
 * caminho em cada teste; é aqui que o caminho em si fica coberto: credenciais
 * válidas, credenciais erradas, campos vazios e a sessão a sobreviver a um
 * refresh.
 *
 * A palavra-passe vem do registo em disco (docs/audits/qa-accounts.json) e
 * nunca está escrita neste ficheiro.
 */

test.describe.configure({ mode: 'serial' });

test('credenciais inválidas não criam sessão', async ({ page }) => {
  const errors = monitorPageErrors(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('O seu email').fill('qa-nao-existe@empregostp.test');
  await page.getByPlaceholder('A sua senha').fill('palavra-passe-errada-123');
  await page.getByRole('button', { name: /entrar|iniciar sessão/i }).first().click();

  // Continua no login e diz alguma coisa; o que não pode é passar.
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(
    page.locator('text=/inválid|incorret|não foi possível|erro/i').first(),
  ).toBeVisible({ timeout: 20_000 });

  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'token')).toBeUndefined();
  expect(errors).toEqual([]);
});

test('campos vazios não submetem', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /entrar|iniciar sessão/i }).first().click();

  await expect(page).toHaveURL(/\/login/);
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'token')).toBeUndefined();
});

test('credenciais válidas abrem o painel e a sessão sobrevive ao refresh', async ({
  page,
  context,
}) => {
  const reason = qaUnavailableReason('candidato_basico');
  test.skip(Boolean(reason), reason ?? '');

  const { email, password } = qaCredentials('candidato_basico');
  const errors = monitorPageErrors(page);

  await logout(context);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('O seu email').fill(email);
  await page.getByPlaceholder('A sua senha').fill(password);
  await page.getByRole('button', { name: /entrar|iniciar sessão/i }).first().click();

  await expect(page).toHaveURL(/\/dashboard\/candidato/, { timeout: 45_000 });

  // O cookie de sessão é httpOnly: só o servidor o escreve.
  const sessionCookie = (await context.cookies()).find(
    (cookie) => cookie.name === 'token',
  );
  expect(sessionCookie, 'não foi criado cookie de sessão').toBeTruthy();
  expect(sessionCookie?.httpOnly).toBe(true);

  // Atualizar a página não pode devolver o utilizador ao login.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard\/candidato/);
  expect(errors).toEqual([]);
});

test('terminar sessão fecha o acesso às rotas privadas', async ({
  page,
  context,
}) => {
  const reason = qaUnavailableReason('candidato_basico');
  test.skip(Boolean(reason), reason ?? '');

  const { email, password } = qaCredentials('candidato_basico');

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('O seu email').fill(email);
  await page.getByPlaceholder('A sua senha').fill(password);
  await page.getByRole('button', { name: /entrar|iniciar sessão/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/candidato/, { timeout: 45_000 });

  // Sair pela API é o mesmo caminho que o botão usa (DELETE da sessão).
  const response = await page.request.delete('/api/auth/session');
  expect(response.status()).toBe(200);
  await context.clearCookies({ name: 'token' });

  const afterLogout = await page.request.get('/dashboard/candidato', {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  expect([302, 307, 308]).toContain(afterLogout.status());
  expect(afterLogout.headers().location).toContain('/login');
});
