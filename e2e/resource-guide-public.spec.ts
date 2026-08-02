import { expect, test } from '@playwright/test';

import { e2ePublicGuide } from './fixtures';
import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

const guideId = process.env.E2E_PUBLIC_GUIDE_ID ?? e2ePublicGuide.id;

test.describe('guia público de recursos', () => {
  test('apresenta o conteúdo estruturado e mantém a leitura acessível', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(`/recursos/guia/${guideId}`, {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Voltar aos recursos' }),
    ).toHaveAttribute('href', '/recursos');

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
