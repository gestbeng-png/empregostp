import { expect, test } from '@playwright/test';

import { e2eCandidate } from './fixtures';
import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('gerador público de currículo', () => {
  test('apresenta o acesso premium sem quebrar o layout público', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/recursos/gerador-cv', {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);
    const main = page.getByRole('main');
    await expect(main).toHaveCount(1);
    await expect(
      main.getByRole('heading', {
        level: 1,
        name: 'Gerador de CV profissional',
      }),
    ).toBeVisible();
    await expect(
      main.getByRole('heading', {
        level: 2,
        name: 'Inicie sessão para criar o seu CV',
      }),
    ).toBeVisible();
    await expect(
      main.getByRole('link', { name: 'Iniciar sessão' }),
    ).toHaveAttribute('href', '/login?redirect=/recursos/gerador-cv');
    await expect(
      main.getByRole('link', { name: 'Ver planos' }),
    ).toHaveAttribute('href', '/premium/candidatos');

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });

  test('mantém os dados do candidato no percurso premium de quatro etapas', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.goto('/login');
    await page.getByLabel('Email').fill(e2eCandidate.email);
    await page.getByLabel('Senha').fill(e2eCandidate.password);
    await page
      .getByRole('button', { name: 'Iniciar sessão', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/candidato/, {
      timeout: 20_000,
    });

    const response = await page.goto('/recursos/gerador-cv', {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Informações pessoais',
      }),
    ).toBeVisible();
    await expect(page.getByLabel('Nome completo')).toHaveValue(
      e2eCandidate.name,
    );
    await expect(
      page.getByRole('button', { name: 'Experiência profissional' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Formação e credenciais' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Competências, idiomas e extras',
      }),
    ).toBeVisible();

    const summary =
      'Profissional de operações com foco em organização e melhoria contínua.';
    await page.getByLabel('Resumo profissional').fill(summary);
    await page.getByRole('button', { name: 'Guardar rascunho' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Rascunho guardado neste dispositivo.',
    );

    await page
      .getByRole('button', { name: 'Experiência profissional' })
      .click();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Experiência profissional',
      }),
    ).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByLabel('Resumo profissional')).toHaveValue(summary);
    await expect(page.getByRole('status')).toContainText(
      'O seu rascunho guardado foi recuperado.',
    );

    await page
      .getByRole('button', {
        name: 'Competências, idiomas e extras',
      })
      .click();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Competências, idiomas e extras',
      }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Concluir e gerar PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^candidata-e2e.*\.pdf$/);

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
