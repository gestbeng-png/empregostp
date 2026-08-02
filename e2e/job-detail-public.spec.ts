import { expect, test } from '@playwright/test';

import { e2ePublicJob } from './fixtures';
import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

const jobId = process.env.E2E_PUBLIC_JOB_ID ?? e2ePublicJob.id;

test.describe('detalhe público de vaga', () => {
  test('/vaga/[id] mantém conteúdo e ações acessíveis', async ({ page }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(`/vaga/${jobId}`, {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Partilhar vaga' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Candidatar agora' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
