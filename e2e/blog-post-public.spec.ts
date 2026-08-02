import { expect, test } from '@playwright/test';

import { e2ePublicPost } from './fixtures';
import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

const postId = process.env.E2E_PUBLIC_POST_ID ?? e2ePublicPost.id;

test.describe('artigo público do blog', () => {
  test('/blog/[id] estrutura texto simples e mantém a leitura acessível', async ({
    page,
  }) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(`/blog/${postId}`, {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    const articleTitle = page.getByRole('heading', { level: 1 });
    await expect(articleTitle).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    const backToBlog = page.getByRole('link', { name: 'Voltar ao blog' });
    await expect(backToBlog).toBeVisible();
    await expect(backToBlog).toHaveAttribute('href', '/blog');
    await expect(backToBlog).toBeInViewport();

    const [backBox, titleBox, viewportHeight] = await Promise.all([
      backToBlog.boundingBox(),
      articleTitle.boundingBox(),
      page.evaluate(() => window.innerHeight),
    ]);
    expect(backBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    if (!backBox || !titleBox) {
      throw new Error('Não foi possível medir a navegação do artigo.');
    }
    expect(backBox.height).toBeGreaterThanOrEqual(44);
    expect(backBox.width).toBeGreaterThanOrEqual(44);
    expect(backBox.y).toBeLessThan(titleBox.y);
    expect(backBox.y + backBox.height).toBeLessThanOrEqual(viewportHeight);

    await backToBlog.focus();
    expect(
      await backToBlog.evaluate(
        (element) => window.getComputedStyle(element).outlineStyle,
      ),
    ).not.toBe('none');

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);

    await backToBlog.click();
    await expect(page).toHaveURL(/\/blog\/?$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
