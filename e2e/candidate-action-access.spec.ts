import { expect, test } from '@playwright/test';

test('visitante mantém o destino de candidato ao iniciar sessão', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/candidatos', { waitUntil: 'domcontentloaded' });
  const verification = page.getByRole('link', {
    name: 'Verificar perfil',
    exact: true,
  });
  await expect(verification).toHaveAttribute(
    'href',
    '/login?redirect=%2Fdashboard%2Fcandidato%3Ftab%3Dverification',
  );
  await expect(
    page.getByRole('link', { name: 'Escolher o plano Premium', exact: true }),
  ).toHaveAttribute('href', '/login?redirect=%2Fpremium%2Fcandidatos');
  await verification.click();
  await expect(page).toHaveURL(
    /\/login\?redirect=%2Fdashboard%2Fcandidato%3Ftab%3Dverification/,
  );
});

test('sem perfil validado, ações ficam desativadas, sem URL e sem modal', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.requestIdleCallback = () => 1;
    window.cancelIdleCallback = () => {};
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/candidatos', { waitUntil: 'load' });
  const verification = page.getByRole('button', {
    name: 'Verificar perfil',
    exact: true,
  });
  await expect(verification).toBeDisabled();
  await expect(verification).not.toHaveAttribute('href');
  await expect(verification).toHaveAttribute('aria-busy', 'true');
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/static/chunks/**', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await verification.click({ force: true });
    await page.keyboard.press('Enter');
    await expect(verification).toBeDisabled();
    await expect(verification).not.toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/candidatos$/);
    const bounds = await verification.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(
      page.viewportSize()?.width || 0,
    );
    await page.screenshot({
      path: testInfo.outputPath('candidate-action-disabled.png'),
    });
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
