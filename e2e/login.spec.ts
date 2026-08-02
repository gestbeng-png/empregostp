import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { pt } from '../shared/i18n/pt';

import { e2eCandidate } from './fixtures';

test.describe('entrada na plataforma', () => {
  test('explica os campos obrigatórios sem quebrar o layout', async ({
    page,
  }) => {
    await page.goto('/login');

    const initialBodyBox = await page.locator('body').boundingBox();
    await page
      .getByRole('button', { name: 'Iniciar sessão', exact: true })
      .click();

    await expect(
      page.getByText('O email e a senha são obrigatórios.'),
    ).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');

    const finalBodyBox = await page.locator('body').boundingBox();
    expect(finalBodyBox?.width).toBe(initialBodyBox?.width);
  });

  test('não apresenta violações automáticas de acessibilidade', async ({
    page,
  }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test('candidato entra e guarda uma preferência', async ({
    page,
  }, testInfo) => {
    test.skip(
      !process.env.FIREBASE_AUTH_EMULATOR_HOST,
      'Esta jornada requer os emuladores Firebase.',
    );

    await page.addInitScript(() => {
      const state = window as Window & { __layoutShiftScore?: number };
      state.__layoutShiftScore = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          };
          if (!shift.hadRecentInput) {
            state.__layoutShiftScore =
              (state.__layoutShiftScore ?? 0) + shift.value;
          }
        }
      }).observe({ buffered: true, type: 'layout-shift' });
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill(e2eCandidate.email);
    await page.getByLabel('Senha').fill(e2eCandidate.password);
    await page
      .getByRole('button', { name: 'Iniciar sessão', exact: true })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/candidato/, {
      timeout: 20_000,
    });
    const menuButton = page.getByRole('button', { name: 'Abrir menu' });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    await page
      .getByRole('button', { name: 'Configurações', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: pt.candidateSettings.header.title }),
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole('navigation', { name: pt.candidateSettings.navigation.label })
      .getByRole('button', {
        name: pt.candidateSettings.navigation.notifications,
      })
      .click();
    await page
      .getByRole('checkbox', {
        name: pt.candidateSettings.notifications.rows.weeklyDigest.title,
      })
      .uncheck();
    await page
      .getByRole('button', { name: pt.candidateSettings.notifications.save })
      .click();

    await expect(
      page.getByText(pt.candidateSettings.feedback.preferencesSaved),
    ).toBeVisible();

    const layoutShiftScore = await page.evaluate(
      () =>
        (window as Window & { __layoutShiftScore?: number })
          .__layoutShiftScore ?? 0,
    );
    expect(layoutShiftScore).toBeLessThan(0.1);

    await testInfo.attach('configuracoes-candidato', {
      body: await page.screenshot({ animations: 'disabled', fullPage: true }),
      contentType: 'image/png',
    });
  });
});
