import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test('o estado offline apresenta recuperação e regresso acessíveis', async ({
  page,
}) => {
  const pageErrors = monitorPageErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto('/offline', { waitUntil: 'networkidle' });

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Não foi possível ligar à internet',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Tentar novamente' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute(
    'href',
    '/',
  );

  const metrics = await collectVisibleUiMetrics(page);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(metrics.smallText).toEqual([]);
  expect(metrics.shortTargets).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(await collectWcagViolations(page)).toEqual([]);
});
