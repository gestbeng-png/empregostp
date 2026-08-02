import { expect, test } from '@playwright/test';

import { e2eCandidate } from './fixtures';
import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

const candidateId =
  process.env.E2E_PUBLIC_CANDIDATE_ID ?? e2eCandidate.uid;

test.describe('perfil público de candidato', () => {
  test('/candidatos/[id] protege os detalhes e mantém a página acessível', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(`/candidatos/${candidateId}`, {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByText(
        'Informações detalhadas deste candidato são exclusivas para empresas com plano elegível.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Iniciar sessão como empresa' }),
    ).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
